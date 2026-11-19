"""Validate the Sentinel source + exports: geometry, skin weights, materials, skeleton, animations."""
import bpy, bmesh, os, math
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
problems = []


def check(cond, msg):
    print(("  OK   " if cond else "  FAIL ") + msg)
    if not cond:
        problems.append(msg)


print("== source/sentinel.blend")
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, "source", "sentinel.blend"))
body = bpy.data.objects["Sentinel_Body"]
rig = bpy.data.objects["Sentinel_Rig"]
me = body.data
bm = bmesh.new()
bm.from_mesh(me)
nonman = [e for e in bm.edges if not e.is_manifold]
loose_v = [v for v in bm.verts if not v.link_faces]
zero_f = [f for f in bm.faces if f.calc_area() < 1e-10]
islands = len(me.vertices)  # placeholder
bm.free()
tris = sum(len(p.vertices) - 2 for p in me.polygons)
print(f"  verts {len(me.vertices)}  tris {tris}  materials {[m.name for m in me.materials]}")
check(len(nonman) == 0, f"non-manifold edges: {len(nonman)}")
check(len(loose_v) == 0, f"loose vertices: {len(loose_v)}")
check(len(zero_f) == 0, f"degenerate faces: {len(zero_f)}")
check(all(m is not None for m in me.materials) and len(me.materials) == 8, "8 PBR/emissive materials assigned")
check(len(me.uv_layers) == 1, "UV layer present")
bones = {b.name for b in rig.data.bones}
groups = {g.name for g in body.vertex_groups}
check(groups <= bones, f"every vertex group matches a bone ({sorted(groups - bones)})")
unw, badsum, over4 = 0, 0, 0
for v in me.vertices:
    ws = [g.weight for g in v.groups if g.weight > 0]
    if not ws:
        unw += 1
    elif abs(sum(ws) - 1) > 1e-3:
        badsum += 1
    if len(ws) > 4:
        over4 += 1
check(unw == 0, f"unweighted vertices: {unw}")
check(badsum == 0, f"vertices with weight sum != 1: {badsum}")
check(over4 == 0, f"vertices with > 4 influences: {over4}")
deform = [b for b in rig.data.bones if b.use_deform]
print(f"  bones total {len(bones)}  deform {len(deform)}")
roots = [b.name for b in rig.data.bones if b.parent is None]
check(roots == ["root"] or set(roots) == {"root"}, f"single skeleton root ({roots})")
for n in ("head", "jaw", "eye_L", "eye_R", "hand_L", "hand_R", "thumb_03_R", "pinky_03_L", "foot_L", "ball_R"):
    check(n in bones, f"bone {n}")
acts = [a.name for a in bpy.data.actions]
print("  actions:", acts)
check(len(acts) >= 9, "9 animation clips")
# pose sanity: in every clip no vertex should fly far from the body
dg = bpy.context.evaluated_depsgraph_get()
for a in bpy.data.actions:
    rig.animation_data.action = a
    worst = 0
    for f in range(int(a.frame_range[0]), int(a.frame_range[1]) + 1, max(1, int((a.frame_range[1] - a.frame_range[0]) / 4) or 1)):
        bpy.context.scene.frame_set(f)
        ev = body.evaluated_get(dg)
        co = np.empty(len(ev.data.vertices) * 3)
        ev.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        r = np.hypot(co[:, 0], co[:, 1]).max()
        worst = max(worst, r, co[:, 2].max() - 2.5)
    check(worst < 1.3, f"{a.name}: posed mesh stays coherent (max radius {worst:.2f} m)")

for fname in ("sentinel.glb", "sentinel_lod1.glb", "sentinel.fbx"):
    print("== export/" + fname)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(ROOT, "export", fname)
    if fname.endswith(".glb"):
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        bpy.ops.import_scene.fbx(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and not o.name.startswith("Icosphere")]  # importer bone-shape helper
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    t = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    imgs = [i for i in bpy.data.images if i.size[0] > 0]
    print(f"  size {os.path.getsize(path)/1e6:.1f} MB  meshes {len(meshes)}  tris {t}  bones {len(arms[0].data.bones) if arms else 0}"
          f"  materials {len(bpy.data.materials)}  images {len(imgs)}  actions {len(bpy.data.actions)}")
    check(len(meshes) == 1 and len(arms) == 1, "one skinned mesh + one armature")
    check(any(m.type == "ARMATURE" for m in meshes[0].modifiers) or meshes[0].parent == arms[0], "mesh bound to armature")
    check(len(imgs) >= (8 if fname.endswith(".fbx") else 14), "textures embedded" + (" (FBX: base colour + normal; ORM in textures/)" if fname.endswith(".fbx") else ""))
    check(len(bpy.data.actions) >= 9, "animation clips present")

print("\nRESULT:", "ALL CHECKS PASSED" if not problems else f"{len(problems)} problem(s)")
