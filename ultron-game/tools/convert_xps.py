"""Convert an XPS-style .blend character (armature + meshes with XPS shader groups) into a game-ready GLB.

usage: python3 convert_xps.py <input.blend> <output.glb>

- applies Subdivision (level 1) under the skin so weights are kept
- rebuilds materials as glTF PBR: diffuse -> base colour, normal map, specular -> roughness (ORM),
  emission maps -> emissive (with strength for bloom)
- drops Blender-only nodes and empty images
The output is meant for private use only (see README) – do not commit it.
"""
import bpy, sys, os, numpy as np

argv = [a for a in sys.argv[1:] if a != "--"]
src, dst = os.path.abspath(argv[-2]), os.path.abspath(argv[-1])
bpy.ops.wm.open_mainfile(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm]


def img_of(mat, *keys):
    best = None
    for n in mat.node_tree.nodes:
        if n.bl_idname == "ShaderNodeTexImage" and n.image and n.image.size[0] > 8:
            nm = n.image.name.lower()
            if any(k in nm for k in keys):
                best = n.image
    return best


def make_orm(spec, name):
    w, h = spec.size
    px = np.empty(w * h * 4, np.float32)
    spec.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    s = px[..., :3].mean(-1)
    rough = np.clip(0.85 - 0.75 * s, 0.12, 0.95)
    orm = np.stack([np.ones_like(s), rough, np.full_like(s, 0.85), np.ones_like(s)], -1).astype(np.float32)
    im = bpy.data.images.new(name, w, h, alpha=False)
    im.pixels.foreach_set(orm.ravel())
    im.colorspace_settings.name = "Non-Color"
    im.pack()
    return im


for ob in meshes:
    for i, mat in enumerate(ob.data.materials):
        if not mat or not mat.node_tree:
            continue
        diff = img_of(mat, "diff", "color", "albedo")
        nrm = img_of(mat, "norm", "nrm")
        spec = img_of(mat, "spec")
        emis = img_of(mat, "emis", "glow")
        is_eye = "eye" in mat.name.lower()
        is_emis = "emission" in mat.name.lower()
        m = bpy.data.materials.new(mat.name + "_pbr")
        nt = m.node_tree
        P = nt.nodes.get("Principled BSDF")
        P.inputs["Metallic"].default_value = 0.85
        P.inputs["Roughness"].default_value = 0.4
        if diff:
            t = nt.nodes.new("ShaderNodeTexImage"); t.image = diff
            nt.links.new(t.outputs["Color"], P.inputs["Base Color"])
        if spec:
            t = nt.nodes.new("ShaderNodeTexImage"); t.image = make_orm(spec, mat.name + "_ORM")
            sp = nt.nodes.new("ShaderNodeSeparateColor")
            nt.links.new(t.outputs["Color"], sp.inputs["Color"])
            nt.links.new(sp.outputs["Green"], P.inputs["Roughness"])
            nt.links.new(sp.outputs["Blue"], P.inputs["Metallic"])
        if nrm:
            nrm.colorspace_settings.name = "Non-Color"
            t = nt.nodes.new("ShaderNodeTexImage"); t.image = nrm
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nt.links.new(t.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], P.inputs["Normal"])
        if is_eye or is_emis:
            P.inputs["Emission Color"].default_value = (1.0, 0.06, 0.02, 1)
            P.inputs["Emission Strength"].default_value = 8.0 if is_eye else 5.0
            if emis or diff:
                t = nt.nodes.new("ShaderNodeTexImage"); t.image = emis or diff
                nt.links.new(t.outputs["Color"], P.inputs["Emission Color"])
        elif emis:
            t = nt.nodes.new("ShaderNodeTexImage"); t.image = emis
            nt.links.new(t.outputs["Color"], P.inputs["Emission Color"])
            P.inputs["Emission Strength"].default_value = 6.0
        ob.data.materials[i] = m
    # subdivision under the skin
    sub = [md for md in ob.modifiers if md.type == "SUBSURF"]
    if sub:
        bpy.context.view_layer.objects.active = ob
        md = sub[0]
        md.levels = 1
        bpy.ops.object.modifier_move_to_index(modifier=md.name, index=0)
        bpy.ops.object.modifier_apply(modifier=md.name)
    ob.data.shade_smooth()

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
for ob in meshes:
    ob.select_set(True)
bpy.context.view_layer.objects.active = arm
os.makedirs(os.path.dirname(dst), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True, export_animations=False,
                          export_image_format="JPEG", export_jpeg_quality=90, export_yup=True, export_skins=True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
print("CONVERTED", dst, "meshes", len(meshes), "tris", tris, "bones", len(arm.data.bones), "size", os.path.getsize(dst))
