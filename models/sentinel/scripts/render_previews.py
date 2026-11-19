"""Render preview shots of source/sentinel.blend with Cycles (headless).
usage: python3 render_previews.py [samples] [shot ...]"""
import bpy, os, sys, math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
args = [a for a in sys.argv[1:] if a != "--"]
SAMPLES = int(args[0]) if args else 64
ONLY = set(args[1:])
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, "source", "sentinel.blend"))
scn = bpy.context.scene
rig = bpy.data.objects["Sentinel_Rig"]
rig.hide_render = True

scn.render.engine = "CYCLES"
scn.cycles.device = "CPU"
scn.cycles.samples = SAMPLES
scn.cycles.use_denoising = True
scn.cycles.max_bounces = 6
scn.render.film_transparent = False
scn.view_settings.view_transform = "AgX"
scn.view_settings.look = "AgX - Punchy" if "AgX - Punchy" in [i.identifier for i in scn.view_settings.bl_rna.properties["look"].enum_items] else "None"

# world: physical sky
w = bpy.data.worlds.new("Sky")
scn.world = w
nt = w.node_tree
bg = nt.nodes.get("Background")
sky = nt.nodes.new("ShaderNodeTexSky")
sky.sky_type = "MULTIPLE_SCATTERING"
sky.sun_elevation = math.radians(32)
sky.sun_rotation = math.radians(200)
nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.07

# ground
bpy.ops.mesh.primitive_plane_add(size=40)
g = bpy.context.object
gm = bpy.data.materials.new("Ground")
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.035, 0.035, 0.038, 1)
gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.85
g.data.materials.append(gm)


def light(name, typ, loc, rot, energy, size=1.0, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, typ)
    ld.energy = energy
    ld.color = color
    if typ == "AREA":
        ld.size = size
    ob = bpy.data.objects.new(name, ld)
    scn.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = [math.radians(a) for a in rot]
    return ob


light("Key", "AREA", (-2.5, -3.0, 3.6), (52, 0, -38), 450, 2.5, (1.0, 0.93, 0.86))
light("Rim_R", "AREA", (2.8, 2.2, 3.0), (-60, 0, 230 - 180), 900, 1.2, (0.75, 0.85, 1.0))
light("Rim_L", "AREA", (-2.8, 2.4, 2.4), (-65, 0, -50 + 180 - 180), 900, 1.2, (0.8, 0.85, 1.0))
light("Fill", "AREA", (2.5, -3.0, 1.2), (75, 0, 40), 90, 3.0, (0.85, 0.9, 1.0))
for ob in [o for o in scn.objects if o.type == "LIGHT"]:
    # aim everything at the chest
    d = Vector((0, 0, 1.5)) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

cam_d = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_d)
scn.collection.objects.link(cam)
scn.camera = cam


def shot(name, action, frame, loc, target, lens, res=(1080, 1350)):
    if ONLY and name not in ONLY:
        return
    rig.animation_data.action = bpy.data.actions[action]
    scn.frame_set(frame)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cam_d.lens = lens
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.render.filepath = os.path.join(ROOT, "renders", name + ".png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name)


shot("01_front", "Pose_Hero", 1, (0.0, -4.4, 1.2), (0, 0, 1.17), 50)
shot("02_back", "Pose_Hero", 1, (0.0, 4.4, 1.2), (0, 0, 1.17), 50)
shot("03_three_quarter", "Pose_Menace", 31, (-2.1, -3.3, 0.7), (0, 0, 1.2), 50)
shot("04_head", "Pose_Hero", 1, (-0.45, -0.95, 2.18), (0, -0.04, 2.1), 85, (1080, 1080))
shot("05_torso_detail", "Idle", 1, (0.9, -1.9, 1.75), (0.05, 0, 1.55), 60, (1350, 1080))
rig.animation_data.action = bpy.data.actions["Hand_Fist"]
scn.frame_set(1)
hp = rig.matrix_world @ rig.pose.bones["middle_01_L"].head
shot("06_hand", "Hand_Fist", 1, tuple(hp + Vector((0.35, -0.55, 0.30))), tuple(hp), 85, (1080, 1080))
