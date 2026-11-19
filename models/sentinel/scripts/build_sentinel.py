"""
SENTINEL — original heavy combat android (procedural high-detail model).

Run:  python3 build_sentinel.py            (needs `pip install bpy`, Blender 4.2+ / 5.x)
  or: blender -b -P build_sentinel.py

Produces (relative to models/sentinel/):
  source/sentinel.blend        - source project (mesh, armature, materials, actions)
  textures/*.png               - PBR maps (base colour, ORM, normal)
  export/sentinel.glb          - LOD0 + skeleton + all animations
  export/sentinel_lod1.glb     - lighter game LOD
  export/sentinel.fbx          - FBX with embedded textures and baked actions

Every armour piece is real geometry (lofted super-ellipse shells with thickness
and bevels); each is skinned rigidly to its bone, cables / cores blend between
bones.  Character faces -Y, Z up, left side = +X, rest pose = T-pose.
"""
import bpy, bmesh, math, os, sys, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
TEX_DIR = os.path.join(ROOT, "textures")
TEX_SIZE = 1024
rad = math.radians

bpy.ops.wm.read_factory_settings(use_empty=True)
SCN = bpy.context.scene
COL = bpy.data.collections.new("Sentinel")
SCN.collection.children.link(COL)
WORK = bpy.data.collections.new("_work")
SCN.collection.children.link(WORK)

# =============================================================== skeleton ===
BONES = []  # name, head, tail, parent, roll_vec, deform


def B(name, head, tail, parent, roll=(0, -1, 0), deform=True):
    BONES.append((name, Vector(head), Vector(tail), parent, Vector(roll), deform))


B("root", (0, 0, 0), (0, 0.25, 0), None, (0, 0, 1))
B("hips", (0, 0, 1.12), (0, 0, 1.26), "root")
B("spine_01", (0, 0, 1.26), (0, 0.005, 1.42), "hips")
B("spine_02", (0, 0.005, 1.42), (0, 0, 1.58), "spine_01")
B("spine_03", (0, 0, 1.58), (0, -0.01, 1.80), "spine_02")
B("neck_01", (0, 0.0, 1.84), (0, -0.005, 1.94), "spine_03")
B("neck_02", (0, -0.005, 1.94), (0, -0.01, 2.02), "neck_01")
B("head", (0, -0.01, 2.02), (0, -0.01, 2.28), "neck_02")
B("jaw", (0, 0.0, 2.075), (0, -0.11, 2.03), "head", (0, 0, 1))
B("eye_L", (0.04, -0.10, 2.14), (0.04, -0.13, 2.14), "head", (0, 0, 1))
B("clavicle_L", (0.03, 0.0, 1.76), (0.20, 0.01, 1.775), "spine_03", (0, 0, 1))
B("upperarm_L", (0.22, 0.01, 1.77), (0.60, 0.01, 1.77), "clavicle_L", (0, 0, 1))
B("forearm_L", (0.60, 0.01, 1.77), (0.93, 0.005, 1.77), "upperarm_L", (0, 0, 1))
B("hand_L", (0.93, 0.005, 1.77), (1.04, 0.0, 1.768), "forearm_L", (0, 0, 1))
FINGERS = {  # name: (y, lengths)
    "index": (-0.036, (0.052, 0.036, 0.030)),
    "middle": (-0.012, (0.058, 0.040, 0.032)),
    "ring": (0.012, (0.054, 0.038, 0.030)),
    "pinky": (0.034, (0.042, 0.030, 0.026)),
}
for fn, (fy, lens) in FINGERS.items():
    p = Vector((1.048 - (0.01 if fn == "pinky" else 0), fy, 1.768))
    par = "hand_L"
    for i, ln in enumerate(lens):
        q = p + Vector((ln, 0, -0.002 * i))
        B(f"{fn}_0{i+1}_L", p, q, par, (0, 0, 1))
        par, p = f"{fn}_0{i+1}_L", q
p = Vector((0.955, -0.038, 1.760))
par = "hand_L"
for i, (d, ln) in enumerate([((0.55, -0.75, -0.30), 0.050), ((0.75, -0.60, -0.25), 0.040), ((0.85, -0.50, -0.20), 0.034)]):
    q = p + Vector(d).normalized() * ln
    B(f"thumb_0{i+1}_L", p, q, par, (0.3, -0.3, 0.9))
    par, p = f"thumb_0{i+1}_L", q
B("thigh_L", (0.115, 0, 1.08), (0.13, -0.015, 0.60), "hips")
B("shin_L", (0.13, -0.015, 0.60), (0.14, 0.015, 0.10), "thigh_L")
B("foot_L", (0.14, 0.015, 0.10), (0.14, -0.10, 0.03), "shin_L", (0, 0, 1))
B("ball_L", (0.14, -0.10, 0.03), (0.14, -0.20, 0.03), "foot_L", (0, 0, 1))
# IK helpers (non-deform, muted constraints; engines usually solve IK themselves)
B("ik_foot_L", (0.14, 0.015, 0.10), (0.14, 0.12, 0.10), "root", (0, 0, 1), False)
B("ik_knee_L", (0.13, -0.6, 0.60), (0.13, -0.7, 0.60), "root", (0, 0, 1), False)
B("ik_hand_L", (0.93, 0.005, 1.77), (0.93, 0.105, 1.77), "root", (0, 0, 1), False)
B("ik_elbow_L", (0.60, 0.5, 1.77), (0.60, 0.6, 1.77), "root", (0, 0, 1), False)

mirrored = []
for (n, h, t, par, roll, de) in BONES:
    if n.endswith("_L"):
        mx = lambda v: Vector((-v.x, v.y, v.z))
        mirrored.append((n[:-2] + "_R", mx(h), mx(t), par[:-2] + "_R" if par and par.endswith("_L") else par, mx(roll), de))
BONES += mirrored

arm_data = bpy.data.armatures.new("Sentinel_Skeleton")
ARM = bpy.data.objects.new("Sentinel_Rig", arm_data)
COL.objects.link(ARM)
bpy.context.view_layer.objects.active = ARM
ARM.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for (n, h, t, par, roll, de) in BONES:
    eb = arm_data.edit_bones.new(n)
    eb.head, eb.tail = h, t
    eb.align_roll(roll)
    eb.use_deform = de
for (n, h, t, par, roll, de) in BONES:
    if par:
        eb = arm_data.edit_bones[n]
        eb.parent = arm_data.edit_bones[par]
        eb.use_connect = (eb.head - eb.parent.tail).length < 1e-5
bpy.ops.object.mode_set(mode="OBJECT")
arm_data.display_type = "OCTAHEDRAL"
ARM.show_in_front = True

# muted IK chains – ready to switch on for animators
for s in "LR":
    for chain, tgt, pole, ln in (("shin", "ik_foot", "ik_knee", 2), ("forearm", "ik_hand", "ik_elbow", 2)):
        c = ARM.pose.bones[f"{chain}_{s}"].constraints.new("IK")
        c.target, c.subtarget = ARM, f"{tgt}_{s}"
        c.pole_target, c.pole_subtarget = ARM, f"{pole}_{s}"
        c.chain_count = ln
        c.pole_angle = rad(-90)
        c.mute = True
for pb in ARM.pose.bones:
    pb.rotation_mode = "QUATERNION"

# ============================================================ textures ======
rng = np.random.default_rng(1977)


def noise(size, beta):
    w = rng.normal(size=(size, size))
    F = np.fft.fft2(w)
    fx = np.fft.fftfreq(size) * size
    f = np.sqrt(fx[:, None] ** 2 + fx[None, :] ** 2)
    f[0, 0] = 1
    F = F / f ** beta
    F[0, 0] = 0
    n = np.real(np.fft.ifft2(F))
    n -= n.min()
    return n / n.max()


def blur(a, k=1):
    for _ in range(k):
        a = (a + np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 5
    return a


def scratches(size, count, lmin, lmax):
    img = np.zeros((size, size), np.float32)
    xs, ys, vs = [], [], []
    dirs = rng.uniform(0, np.pi, 3)
    for _ in range(count):
        x0, y0 = rng.uniform(0, size, 2)
        ang = rng.choice(dirs) + rng.normal(0, 0.2) if rng.random() < 0.7 else rng.uniform(0, np.pi)
        L = lmin + (lmax - lmin) * rng.random() ** 2
        t = np.arange(0, L, 0.7)
        xs.append((x0 + np.cos(ang) * t).astype(int) % size)
        ys.append((y0 + np.sin(ang) * t).astype(int) % size)
        vs.append(rng.uniform(0.3, 1.0) * np.sin(np.pi * t / L) ** 0.5)
    np.maximum.at(img, (np.concatenate(ys), np.concatenate(xs)), np.concatenate(vs).astype(np.float32))
    return img


def smoothstep(a, b, x):
    x = np.clip((x - a) / (b - a), 0, 1)
    return x * x * (3 - 2 * x)


S = TEX_SIZE
FINE, MID, LOW = noise(S, 0.9), noise(S, 1.6), noise(S, 2.5)
SCR = scratches(S, 1800, 4, 70)
SCR = np.clip(SCR * 0.9, 0, 1)
DENT = smoothstep(0.62, 0.9, noise(S, 2.8))
GRIME = smoothstep(0.42, 0.82, LOW * 0.7 + MID * 0.3)
PANEL = (noise(S, 1.2) > 0.985).astype(float)  # tiny pits / chips
CHIP = smoothstep(0.80, 0.92, blur(noise(S, 1.3), 2)) * SCR.clip(0.2, 1)


def normal_map(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    n = np.stack([-dx, -dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def save_img(name, rgb, srgb):
    path = os.path.join(TEX_DIR, name + ".png")
    img = bpy.data.images.new(name, S, S, alpha=False)
    rgba = np.concatenate([rgb, np.ones(rgb.shape[:2] + (1,))], -1).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    img.filepath = "//../textures/" + name + ".png"
    img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    return img


H_ARMOR = 0.10 * FINE + 0.25 * MID - 0.25 * SCR - 0.2 * DENT - 0.3 * PANEL
H_MECH = 0.25 * FINE + 0.1 * MID - 0.4 * SCR
NRM = {"armor": save_img("T_Armor_N", normal_map(H_ARMOR, 1.6), False),
       "mech": save_img("T_Mech_N", normal_map(H_MECH, 1.4), False)}

# name: tint(linear), rough, metal, scratch amount, grime amount, normal
MAT_DEFS = {
    "gun":    ((0.040, 0.042, 0.047), 0.40, 1.0, 1.0, 1.0, "armor"),
    "steel":  ((0.20, 0.20, 0.215), 0.30, 1.0, 0.8, 0.8, "armor"),
    "mech":   ((0.028, 0.026, 0.026), 0.52, 0.85, 0.5, 1.2, "mech"),
    "bronze": ((0.32, 0.16, 0.08), 0.33, 1.0, 0.6, 0.9, "mech"),
    "chrome": ((0.62, 0.62, 0.64), 0.10, 1.0, 0.25, 0.2, "mech"),
    "rubber": ((0.018, 0.018, 0.02), 0.78, 0.0, 0.3, 0.6, "mech"),
}
MATS = {}
for key, (tint, r0, metal, sa, ga, nrm) in MAT_DEFS.items():
    tint = np.array(tint)
    alb = tint[None, None, :] * (0.85 + 0.3 * (MID - 0.5))[..., None]
    alb = alb * (1 - 0.5 * ga * GRIME[..., None]) + 0.012 * ga * GRIME[..., None] * np.array([1.0, 0.8, 0.6])
    bright = np.maximum(tint * 2.2, 0.35)
    alb = alb * (1 - (sa * SCR * 0.3)[..., None]) + (sa * SCR * 0.3)[..., None] * bright
    alb = alb * (1 - (CHIP * sa * 0.35)[..., None]) + (CHIP * sa * 0.35)[..., None] * bright * 1.2
    rough = np.clip(r0 + 0.12 * (MID - 0.5) + 0.04 * (FINE - 0.5) + 0.25 * ga * GRIME - 0.10 * sa * SCR, 0.04, 1.0)
    met = np.clip(metal * (1 - 0.25 * ga * GRIME) + 0 * FINE, 0, 1)
    ao = 1 - 0.25 * GRIME * ga
    base_img = save_img(f"T_{key}_BaseColor", np.clip(alb, 0, 1) ** (1 / 2.2), True)
    orm_img = save_img(f"T_{key}_ORM", np.stack([ao, rough, met], -1), False)

    m = bpy.data.materials.new(f"M_{key.capitalize()}")
    if hasattr(m, "use_nodes") and not m.node_tree:
        m.use_nodes = True
    nt = m.node_tree
    P = nt.nodes.get("Principled BSDF")
    tb = nt.nodes.new("ShaderNodeTexImage"); tb.image = base_img; tb.location = (-600, 300)
    to = nt.nodes.new("ShaderNodeTexImage"); to.image = orm_img; to.location = (-600, 0)
    sp = nt.nodes.new("ShaderNodeSeparateColor"); sp.location = (-300, 0)
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = NRM[nrm]; tn.location = (-600, -300)
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.location = (-300, -300); nm.inputs["Strength"].default_value = 1.0
    nt.links.new(tb.outputs["Color"], P.inputs["Base Color"])
    nt.links.new(to.outputs["Color"], sp.inputs["Color"])
    nt.links.new(sp.outputs["Green"], P.inputs["Roughness"])
    nt.links.new(sp.outputs["Blue"], P.inputs["Metallic"])
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], P.inputs["Normal"])
    MATS[key] = m

for key, col, strength in (("eye", (1.0, 0.04, 0.015), 40.0), ("glow", (1.0, 0.08, 0.02), 8.0)):
    m = bpy.data.materials.new(f"M_{key.capitalize()}_Emissive")
    if hasattr(m, "use_nodes") and not m.node_tree:
        m.use_nodes = True
    P = m.node_tree.nodes.get("Principled BSDF")
    P.inputs["Base Color"].default_value = (*col, 1)
    P.inputs["Emission Color"].default_value = (*col, 1)
    P.inputs["Emission Strength"].default_value = strength
    P.inputs["Roughness"].default_value = 0.2
    MATS[key] = m

# ========================================================= geometry core ===


def cr(keys, t):
    """Catmull-Rom interpolation of keyed values; constants and callables pass through."""
    if callable(keys):
        return keys(t)
    if not isinstance(keys, list):
        return keys
    ts = [k[0] for k in keys]
    vs = [np.atleast_1d(np.array(k[1], float)) for k in keys]
    if t <= ts[0]:
        v = vs[0]
    elif t >= ts[-1]:
        v = vs[-1]
    else:
        i = max(j for j in range(len(ts) - 1) if ts[j] <= t)
        u = (t - ts[i]) / (ts[i + 1] - ts[i])
        p0, p1, p2, p3 = vs[max(i - 1, 0)], vs[i], vs[i + 1], vs[min(i + 2, len(vs) - 1)]
        v = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
    return tuple(v) if len(v) > 1 else float(v[0])


def frame(p0, p1, fwd):
    p0, p1 = Vector(p0), Vector(p1)
    u = p1 - p0
    L = u.length
    u.normalize()
    f = Vector(fwd)
    f = (f - u * f.dot(u)).normalized()
    return p0, u, f, u.cross(f), L


def surf(p0, p1, fwd, R, O=(0.0, 0.0), A=(0.0, 360.0), N=2.0, nt=12, na=20, caps=True):
    """Lofted super-ellipse surface along p0->p1.
    Angle 0 = side axis s (= u x f), 90 = fwd axis f.  R -> (rs, rf), O -> (offset_s, offset_f)."""
    p0, u, f, s, L = frame(p0, p1, fwd)
    bm = bmesh.new()
    full = not isinstance(A, list) and not callable(A) and (A[1] - A[0]) >= 359.9
    m = na if full else na + 1
    rings = []
    for i in range(nt + 1):
        t = i / nt
        rs, rf = cr(R, t)
        os_, of = cr(O, t)
        a0, a1 = cr(A, t)
        ne = cr(N, t)
        rs, rf = max(rs, 2e-4), max(rf, 2e-4)
        ring = []
        for j in range(m):
            a = rad(a0 + (a1 - a0) * j / na)
            c, sn = math.cos(a), math.sin(a)
            x = rs * math.copysign(abs(c) ** (2 / ne), c)
            y = rf * math.copysign(abs(sn) ** (2 / ne), sn)
            ring.append(bm.verts.new(p0 + u * (t * L) + s * (x + os_) + f * (y + of)))
        rings.append(ring)
    for i in range(nt):
        r0, r1 = rings[i], rings[i + 1]
        for j in range(m if full else m - 1):
            j2 = (j + 1) % m
            bm.faces.new((r0[j], r0[j2], r1[j2], r1[j]))
    if full and caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return bm


def lathe(origin, direction, up, prof, na=24):
    """Revolve profile [(distance_along_axis, radius)] around an axis."""
    p0, u, f, s, L = frame(origin, Vector(origin) + Vector(direction), up)
    bm = bmesh.new()
    rings = []
    for d, r in prof:
        c = p0 + u * d
        if r <= 1e-6:
            rings.append([bm.verts.new(c)])
        else:
            rings.append([bm.verts.new(c + (s * math.cos(2 * math.pi * j / na) + f * math.sin(2 * math.pi * j / na)) * r) for j in range(na)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for j in range(na):
                bm.faces.new((a[0], b[j], b[(j + 1) % na]))
        elif len(b) == 1:
            for j in range(na):
                bm.faces.new((a[(j + 1) % na], a[j], b[0]))
        else:
            for j in range(na):
                bm.faces.new((a[j], a[(j + 1) % na], b[(j + 1) % na], b[j]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return bm


def tube(pts, r, n=8, step=0.006, rib=0.0, ribf=180.0):
    """Swept cable through control points (Catmull-Rom) with optional corrugation."""
    pts = [Vector(p) for p in pts]
    P = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]

    def cat(i, u):
        p0, p1, p2, p3 = P[i], P[i + 1], P[i + 2], P[i + 3]
        return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)

    samp = []
    for i in range(len(pts) - 1):
        k = max(4, int((pts[i + 1] - pts[i]).length / step))
        samp += [cat(i, j / k) for j in range(k)]
    samp.append(pts[-1])
    bm = bmesh.new()
    t0 = (samp[1] - samp[0]).normalized()
    nrm = t0.orthogonal().normalized()
    rings, dist = [], 0.0
    for i, c in enumerate(samp):
        t = (samp[min(i + 1, len(samp) - 1)] - samp[max(i - 1, 0)]).normalized()
        nrm = (nrm - t * nrm.dot(t)).normalized()
        b = t.cross(nrm)
        if i:
            dist += (c - samp[i - 1]).length
        rr = r * (1 + rib * (0.5 + 0.5 * math.copysign(1, math.sin(dist * ribf))))
        rings.append([bm.verts.new(c + (nrm * math.cos(2 * math.pi * j / n) + b * math.sin(2 * math.pi * j / n)) * rr) for j in range(n)])
    for a, b in zip(rings, rings[1:]):
        for j in range(n):
            bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return bm


ALL = []


def grad(axis, anchors):
    """Weight function blending bones along a world axis value."""
    def w(co):
        v = co[axis] if isinstance(axis, int) else axis(co)
        if v <= anchors[0][0]:
            return {anchors[0][1]: 1.0}
        for (v0, b0), (v1, b1) in zip(anchors, anchors[1:]):
            if v <= v1:
                x = (v - v0) / (v1 - v0)
                x = x * x * (3 - 2 * x)
                d = {b0: 1 - x}
                d[b1] = d.get(b1, 0) + x
                return d
        return {anchors[-1][1]: 1.0}
    return w


def part(bm, bone, mat, name="part", solid=0.0, bevel=0.0, subd=0, sharp=38, mirror=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    WORK.objects.link(ob)
    if subd:
        md = ob.modifiers.new("sub", "SUBSURF"); md.levels = md.render_levels = subd
    if solid:
        md = ob.modifiers.new("sol", "SOLIDIFY"); md.thickness = solid; md.offset = 0; md.use_even_offset = True
    if bevel:
        md = ob.modifiers.new("bev", "BEVEL"); md.width = bevel; md.segments = 2
        md.limit_method = "ANGLE"; md.angle_limit = rad(32)
    if ob.modifiers:
        dg = bpy.context.evaluated_depsgraph_get()
        me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        ob.modifiers.clear()
        ob.data = me2
        bpy.data.meshes.remove(me)
        me = me2
    b2 = bmesh.new(); b2.from_mesh(me)
    bmesh.ops.remove_doubles(b2, verts=b2.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(b2, faces=b2.faces)
    b2.to_mesh(me); b2.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=rad(sharp))
    me.materials.append(MATS[mat])
    if callable(bone):
        groups = {}
        for v in me.vertices:
            for bn, wt in bone(v.co).items():
                if wt > 1e-4:
                    if bn not in groups:
                        groups[bn] = ob.vertex_groups.new(name=bn)
                    groups[bn].add([v.index], wt, "REPLACE")
    else:
        ob.vertex_groups.new(name=bone).add(range(len(me.vertices)), 1.0, "REPLACE")
    ALL.append(ob)
    if mirror:
        mirror_ob(ob)
    return ob


def mirror_ob(ob):
    me = ob.data.copy()
    me.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    b2 = bmesh.new(); b2.from_mesh(me)
    bmesh.ops.reverse_faces(b2, faces=b2.faces)
    b2.to_mesh(me); b2.free()
    ob2 = bpy.data.objects.new(ob.name + "_mir", me)
    WORK.objects.link(ob2)
    ob2.vertex_groups.clear()  # copied mesh carries the source groups – rebuild them mirrored
    ren = lambda n: n[:-2] + "_R" if n.endswith("_L") else n
    gmap = {vg.index: ob2.vertex_groups.new(name=ren(vg.name)) for vg in ob.vertex_groups}
    for v in ob.data.vertices:
        for g in v.groups:
            gmap[g.group].add([v.index], g.weight, "REPLACE")
    ALL.append(ob2)


def piston(a, b, r, bone_a, bone_b=None, mirror=True, up=(0, 0, 1)):
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    if abs(d.normalized().dot(Vector(up))) > 0.9:
        up = (0, -1, 0)
    h = 0.58 * L
    part(lathe(a, d, up, [(0, 0), (0, r * 0.7), (0.005, r * 1.15), (0.012, r * 1.15), (0.014, r), (h - 0.012, r),
                          (h - 0.01, r * 1.12), (h, r * 1.12), (h, r * 0.6), (h + 0.003, r * 0.6), (h + 0.003, 0)], 16),
         bone_a, "mech", mirror=mirror, sharp=30)
    part(lathe(a, d, up, [(h - 0.02, 0), (h - 0.02, r * 0.45), (L - 0.014, r * 0.45), (L - 0.014, r * 0.8),
                          (L, r * 0.8), (L, 0)], 12), bone_b or bone_a, "chrome", mirror=mirror, sharp=30)


def joint(c, axis, r, w, bone, mat="steel", up=(0, 0, 1), mirror=True):
    """Grooved mechanical hinge drum."""
    c, axis = Vector(c), Vector(axis).normalized()
    o = c - axis * (w / 2)
    if abs(axis.dot(Vector(up))) > 0.9:
        up = (0, -1, 0)
    prof = [(0, 0), (0, r * 0.55), (0.003, r * 0.62), (0.003, r * 0.85), (0.008, r), (w * 0.3, r), (w * 0.3, r * 0.9),
            (w * 0.36, r * 0.9), (w * 0.36, r), (w * 0.64, r), (w * 0.64, r * 0.9), (w * 0.7, r * 0.9), (w * 0.7, r),
            (w - 0.008, r), (w - 0.003, r * 0.85), (w - 0.003, r * 0.62), (w, r * 0.55), (w, 0)]
    part(lathe(o, axis, up, prof, 28), bone, mat, mirror=mirror, sharp=30)
    # bronze hub caps
    for e, sgn in ((o, -1), (o + axis * w, 1)):
        part(lathe(e, axis * sgn, up, [(-0.001, 0), (-0.001, r * 0.5), (0.004, r * 0.45), (0.006, r * 0.3), (0.007, 0)], 20),
             bone, "bronze", mirror=mirror, sharp=30)


def bolt(c, normal, r, bone, mirror=True):
    part(lathe(Vector(c) - Vector(normal).normalized() * 0.002, normal, (0, 0, 1) if abs(Vector(normal).normalized().z) < 0.9 else (0, -1, 0),
               [(0, 0), (0, r), (0.004, r), (0.006, r * 0.7), (0.0065, 0)], 6), bone, "chrome", mirror=mirror, sharp=30)


# =================================================================== BODY ===
FWD = (0, -1, 0)


def lin(a, b):
    return [(0, a), (1, b)]


# ---------------------------------------------------------------- pelvis ---
PELV_R = [(0, (0.10, 0.08)), (0.2, (0.16, 0.11)), (0.55, (0.17, 0.115)), (0.85, (0.145, 0.10)), (1, (0.125, 0.09))]
PZ0, PZ1 = 0.98, 1.30


def pelvR(z, add):
    rs, rf = cr(PELV_R, (z - PZ0) / (PZ1 - PZ0))
    return (rs + add, rf + add)


part(surf((0, 0, PZ0), (0, 0, PZ1), FWD, PELV_R, N=2.6, nt=14, na=28), "hips", "mech", "pelvis_core", mirror=False)
part(surf((0, 0, 1.215), (0, 0, 1.285), FWD, lambda t: pelvR(1.215 + 0.07 * t, 0.018), nt=3, na=48), "hips", "steel", "belt",
     solid=0.012, bevel=0.002, mirror=False)
for a in range(0, 360, 30):
    if a in (90, 270):
        continue
    rs, rf = pelvR(1.25, 0.026)
    p = Vector((rs * math.cos(rad(a)) ** 1, -rf * math.sin(rad(a)), 1.25))
    bolt(p, (math.cos(rad(a)), -math.sin(rad(a)), 0), 0.007, "hips", mirror=False)
# belt buckle module
part(surf((0, -0.11, 1.215), (0, -0.11, 1.29), FWD, (0.045, 0.025), O=(0, -0.025), N=6, nt=4, na=24), "hips", "gun", "buckle",
     bevel=0.003, mirror=False)
part(surf((0, -0.11, 1.235), (0, -0.11, 1.27), FWD, (0.022, 0.01), O=(0, -0.05), N=4, nt=2, na=16), "hips", "glow", "buckle_glow", mirror=False)
# codpiece – two layers
part(surf((0, 0, 0.98), (0, 0, 1.22), FWD, lambda t: pelvR(0.98 + 0.24 * t, 0.012 + 0.01 * math.sin(math.pi * t)),
          A=[(0, (80, 100)), (0.5, (62, 118)), (1, (55, 125))], nt=12, na=16), "hips", "gun", "codpiece", solid=0.014, bevel=0.003, mirror=False)
part(surf((0, 0, 1.04), (0, 0, 1.20), FWD, lambda t: pelvR(1.04 + 0.16 * t, 0.032), A=[(0, (84, 96)), (1, (74, 106))], nt=8, na=8),
     "hips", "steel", "codpiece2", solid=0.01, bevel=0.002, mirror=False)
# side tassets
part(surf((0, 0, 1.00), (0, 0, 1.24), FWD, lambda t: pelvR(1.0 + 0.24 * t, 0.025), A=[(0, (-28, 22)), (1, (-35, 35))], nt=10, na=14),
     grad(2, [(1.02, "thigh_L"), (1.2, "hips")]), "gun", "tasset_L", solid=0.014, bevel=0.003)
part(surf((0, 0, 1.06), (0, 0, 1.23), FWD, lambda t: pelvR(1.06 + 0.17 * t, 0.042), A=[(0, (-18, 14)), (1, (-24, 24))], nt=8, na=10),
     grad(2, [(1.06, "thigh_L"), (1.2, "hips")]), "steel", "tasset2_L", solid=0.01, bevel=0.002)
# glute plates
part(surf((0, 0, 0.99), (0, 0, 1.20), FWD, lambda t: pelvR(0.99 + 0.21 * t, 0.02 + 0.01 * math.sin(math.pi * t)),
          A=[(0, (282, 330)), (0.6, (275, 340)), (1, (278, 335))], nt=10, na=14), "hips", "gun", "glute_L", solid=0.014, bevel=0.003)

# --------------------------------------------------------------- waist ---
WAIST_R = [(0, (0.13, 0.095)), (0.4, (0.112, 0.085)), (1, (0.145, 0.10))]
WZ0, WZ1 = 1.22, 1.52


def waistR(z, add):
    rs, rf = cr(WAIST_R, (z - WZ0) / (WZ1 - WZ0))
    return (rs + add, rf + add)


SPINE_W = grad(2, [(1.24, "hips"), (1.30, "spine_01"), (1.44, "spine_02"), (1.60, "spine_03")])
part(surf((0, 0, WZ0), (0, 0, WZ1), FWD, WAIST_R, N=2.2, nt=14, na=28), SPINE_W, "mech", "waist_core", mirror=False)
# internal spine column visible through the side gaps
for k in range(7):
    z = 1.24 + k * 0.042
    part(lathe((0, 0.03, z), (0, 0, 1), FWD, [(0, 0), (0, 0.05), (0.006, 0.058), (0.022, 0.058), (0.028, 0.05), (0.028, 0)], 20),
         SPINE_W, "steel" if k % 2 else "mech", f"waist_vert{k}", mirror=False)
for k in range(5):
    z0 = 1.25 + k * 0.052
    bone = "spine_01" if z0 < 1.40 else "spine_02"
    # abdominal scale-slats (left, mirrored)
    part(surf((0, 0, z0), (0, 0, z0 + 0.048), FWD, lambda t, z0=z0: waistR(z0 + 0.048 * t, 0.010 + 0.016 * t),
              A=[(0, (12, 84)), (1, (8, 86))], nt=3, na=16), bone, "gun", f"abslat{k}_L", solid=0.008, bevel=0.002)
    # back slats
    part(surf((0, 0, z0), (0, 0, z0 + 0.048), FWD, lambda t, z0=z0: waistR(z0 + 0.048 * t, 0.012 + 0.014 * t),
              A=[(0, (280, 348)), (1, (276, 352))], nt=3, na=14), bone, "gun", f"backslat{k}_L", solid=0.008, bevel=0.002)
    # centre segmented strip
    part(surf((0, 0, z0 + 0.004), (0, 0, z0 + 0.046), FWD, lambda t, z0=z0: waistR(z0 + 0.046 * t, 0.026 + 0.008 * t),
              A=[(0, (85.5, 94.5)), (1, (84, 96))], nt=3, na=6), bone, "steel", f"abcenter{k}", solid=0.01, bevel=0.002, mirror=False)
# oblique cables
for pts in (((0.105, -0.05, 1.22), (0.12, -0.035, 1.36), (0.15, -0.04, 1.52)),
            ((0.11, 0.05, 1.22), (0.125, 0.055, 1.36), (0.15, 0.07, 1.52)),
            ((0.12, 0.0, 1.22), (0.135, 0.01, 1.37), (0.16, 0.02, 1.53))):
    part(tube(pts, 0.011, 8, rib=0.12, ribf=500), SPINE_W, "bronze", "oblique_cable_L", sharp=60)

# --------------------------------------------------------------- chest ---
CHEST_R = [(0, (0.14, 0.10)), (0.3, (0.20, 0.13)), (0.6, (0.24, 0.145)), (0.85, (0.22, 0.13)), (1, (0.12, 0.09))]
CZ0, CZ1 = 1.48, 1.88


def chestR(z, add):
    rs, rf = cr(CHEST_R, (z - CZ0) / (CZ1 - CZ0))
    return (rs + add, rf + add)


def C(z0, z1, add, **kw):
    return surf((0, 0, z0), (0, 0, z1), FWD, lambda t: chestR(z0 + (z1 - z0) * t, cr(add, t)), **kw)


CHEST_W = grad(2, [(1.50, "spine_02"), (1.62, "spine_03")])
part(surf((0, 0, CZ0), (0, 0, CZ1), FWD, CHEST_R, N=2.4, nt=16, na=32), CHEST_W, "mech", "chest_core", mirror=False)
# pectoral armour – main plate + clavicle plate
part(C(1.56, 1.84, lambda t: 0.022 + 0.018 * math.sin(math.pi * t), A=[(0, (30, 80)), (0.3, (14, 86)), (0.8, (10, 87)), (1, (26, 81))],
       nt=14, na=20), "spine_03", "gun", "pec_L", solid=0.016, bevel=0.003)
part(C(1.60, 1.80, lambda t: 0.045 + 0.012 * math.sin(math.pi * t), A=[(0, (52, 82)), (0.5, (38, 84)), (1, (44, 82))], nt=10, na=12),
     "spine_03", "gun", "pec_inner_L", solid=0.012, bevel=0.0025)
part(C(1.76, 1.885, lambda t: 0.050 - 0.01 * t, A=[(0, (18, 85)), (1, (40, 82))], nt=6, na=16), "spine_03", "steel", "clavplate_L",
     solid=0.012, bevel=0.0025)
# sternum keel and vent
part(C(1.52, 1.83, [(0, 0.03), (0.6, 0.05), (1, 0.045)], A=[(0, (86.5, 93.5)), (0.5, (83, 97)), (1, (80, 100))], nt=12, na=6),
     CHEST_W, "steel", "keel", solid=0.014, bevel=0.003, mirror=False)
part(C(1.495, 1.535, 0.012, A=(76, 104), nt=2, na=10), CHEST_W, "glow", "chest_vent", solid=0.01, mirror=False)
for k in range(3):
    z = 1.497 + k * 0.013
    part(C(z, z + 0.006, 0.024, A=(74, 106), nt=1, na=10), CHEST_W, "mech", f"chest_vent_bar{k}", solid=0.006, mirror=False)
# serratus slats
for k in range(4):
    z0 = 1.50 + k * 0.052
    part(C(z0, z0 + 0.048, lin(0.008, 0.03), A=[(0, (-22, 30)), (1, (-26, 36))], nt=3, na=12),
         "spine_02" if k < 2 else "spine_03", "gun", f"serratus{k}_L", solid=0.009, bevel=0.002)
# back: scapula plates, vents, spine ridge
part(C(1.58, 1.86, lambda t: 0.026 + 0.012 * math.sin(math.pi * t), A=[(0, (285, 335)), (0.5, (272, 348)), (1, (282, 342))],
       nt=14, na=18), "spine_03", "gun", "scapula_L", solid=0.016, bevel=0.003)
part(C(1.62, 1.80, 0.046, A=[(0, (290, 330)), (0.5, (282, 338)), (1, (292, 330))], nt=8, na=10), "spine_03", "steel",
     "scapula2_L", solid=0.01, bevel=0.002)
part(C(1.49, 1.63, lin(0.016, 0.022), A=[(0, (280, 328)), (1, (278, 334))], nt=6, na=12), CHEST_W, "gun", "lowerlat_L",
     solid=0.012, bevel=0.0025)
part(C(1.44, 1.57, 0.004, A=(256, 284), nt=4, na=8), SPINE_W, "glow", "back_glow", solid=0.006, mirror=False)
for k in range(5):
    z0 = 1.445 + k * 0.025
    part(C(z0, z0 + 0.012, 0.018, A=(253, 287), nt=1, na=10), SPINE_W, "mech", f"back_vent_bar{k}", solid=0.006, mirror=False)
for k in range(11):
    z = 1.28 + k * 0.054
    rf = (waistR(z, 0)[1] if z < 1.5 else chestR(z, 0)[1])
    y = rf + 0.006
    part(lathe((0, y, z), (0, 0, 1), FWD, [(0, 0), (0, 0.022), (0.005, 0.029), (0.03, 0.029), (0.036, 0.022), (0.036, 0)], 16),
         SPINE_W, "steel", f"spine_vert{k}", mirror=False)
    part(surf((0, y + 0.02, z + 0.004), (0, y + 0.02, z + 0.034), (0, 1, 0), lin((0.006, 0.016), (0.004, 0.022)),
              O=lin((0, 0.004), (0, 0.012)), N=4, nt=2, na=12), SPINE_W, "gun", f"spine_fin{k}", bevel=0.0015, mirror=False)
# trapezius
TRAP_W = grad(0, [(0.07, "spine_03"), (0.19, "clavicle_L")])
part(surf((0.04, 0.02, 1.90), (0.21, 0.02, 1.82), FWD, lin((0.04, 0.055), (0.05, 0.07)), N=2.3, nt=8, na=16), TRAP_W, "mech", "trap_core_L")
part(surf((0.03, 0.025, 1.905), (0.215, 0.02, 1.83), FWD, lin((0.052, 0.068), (0.062, 0.085)), A=[(0, (125, 295)), (1, (140, 290))],
          nt=10, na=16), TRAP_W, "gun", "trap_L", solid=0.014, bevel=0.003)

# ---------------------------------------------------------------- neck ---
NECK_W = grad(2, [(1.84, "spine_03"), (1.90, "neck_01"), (1.98, "neck_02"), (2.04, "head")])
for k in range(5):
    z = 1.85 + k * 0.038
    part(lathe((0, 0.015, z), (0, 0, 1), FWD, [(0, 0), (0, 0.033), (0.006, 0.042), (0.02, 0.042), (0.026, 0.033), (0.026, 0)], 20),
         "neck_01" if z < 1.94 else "neck_02", "steel" if k % 2 else "mech", f"neck_vert{k}", mirror=False)
part(lathe((0, 0.015, 1.84), (0, 0, 1), FWD, [(0, 0), (0, 0.024), (0.2, 0.024), (0.2, 0)], 12), NECK_W, "mech", "neck_core", mirror=False)
for k in range(10):
    a = rad(k * 36 + 18)
    p0 = Vector((math.cos(a) * 0.10, -math.sin(a) * 0.075 + 0.01, 1.82))
    p2 = Vector((math.cos(a) * 0.052, -math.sin(a) * 0.05 - 0.005, 2.035))
    p1 = (p0 + p2) / 2 + Vector((math.cos(a) * 0.012, -math.sin(a) * 0.012, 0))
    part(tube((p0, p1, p2), 0.0085, 8, rib=0.15, ribf=600), NECK_W, "bronze" if k % 3 else "rubber", f"neck_cable{k}", sharp=60, mirror=False)
piston((0.065, -0.07, 1.83), (0.045, -0.04, 2.03), 0.012, "neck_01", "head")
for k in range(3):
    z = 1.89 + k * 0.05
    part(surf((0, 0.02, z), (0, 0.02, z + 0.055), FWD, lin((0.085 - k * 0.01, 0.075 - k * 0.006), (0.08 - k * 0.01, 0.08 - k * 0.006)),
              A=[(0, (215, 325)), (1, (222, 318))], nt=3, na=14), ["neck_01", "neck_02", "head"][k], "gun", f"neck_guard{k}",
         solid=0.01, bevel=0.002, mirror=False)

# ---------------------------------------------------------------- head ---
HC = Vector((0, -0.015, 2.135))
HW, HH, HD = 0.100, 0.138, 0.122


def hk(x):
    return math.sqrt(max(1 - (x / HW) ** 2, 0.02))


def hshell(x0, x1, A, add, nt=14, na=22, extra=None):
    def R(t):
        x = x0 + (x1 - x0) * t
        k = hk(x)
        a = add(x) if callable(add) else add
        return (HH * k + a, HD * k + a)
    return surf((x0, HC.y, HC.z), (x1, HC.y, HC.z), FWD, R, A=lambda t: A(x0 + (x1 - x0) * t), nt=nt, na=na)


def brow(x):
    return 99 + 16 * (abs(x) / 0.1) ** 1.4


# inner dark skull
def skullR(t):
    z = HC.z - HH * 0.98 + t * HH * 1.9
    k = math.sqrt(max(1 - ((z - HC.z) / HH) ** 2, 0.12))
    return (HW * 0.92 * k, HD * 0.92 * k)


part(surf((0, HC.y, HC.z - HH * 0.98), (0, HC.y, HC.z + HH * 0.92), FWD, skullR,
          O=lambda t: (0, 0.014 * math.exp(-((t - 0.25) / 0.15) ** 2)), nt=16, na=32), "head", "mech", "skull", mirror=False)
# cranium helmet
part(hshell(-0.10, 0.10, lambda x: (brow(x), 300 - 12 * abs(x) / 0.1), 0.012, nt=20, na=26), "head", "gun", "cranium",
     solid=0.012, bevel=0.002, mirror=False)
part(hshell(-0.095, 0.095, lambda x: (brow(x) - 3, brow(x) + 11), 0.026, nt=18, na=5), "head", "steel", "brow", solid=0.01,
     bevel=0.002, mirror=False)
# face mask (upper) & jaw
part(hshell(-0.088, 0.088, lambda x: (50 + 10 * abs(x) / 0.088, 84 - 12 * (abs(x) / 0.088) ** 1.3),
            lambda x: 0.014 + 0.009 * math.exp(-(x / 0.018) ** 2), nt=20, na=12), "head", "steel", "facemask", solid=0.01, bevel=0.002, mirror=False)
part(hshell(-0.08, 0.08, lambda x: (14 + 20 * (abs(x) / 0.08) ** 1.5, 47 - 3 * abs(x) / 0.08),
            lambda x: 0.011 + 0.007 * math.exp(-(x / 0.02) ** 2), nt=18, na=10), "jaw", "steel", "jaw", solid=0.01, bevel=0.002, mirror=False)
part(hshell(-0.05, 0.05, lambda x: (36, 46), 0.0, nt=8, na=4), "jaw", "mech", "mouth_inner", solid=0.012, mirror=False)
for k in range(7):
    x = -0.03 + k * 0.01
    part(hshell(x - 0.002, x + 0.002, lambda xx: (45.5, 51.5), 0.006, nt=1, na=3), "head", "chrome", f"mouth_bar{k}", solid=0.004, mirror=False)
# cheek plates, side strakes, crest, temple drums
part(hshell(0.052, 0.108, lambda x: (38 + 40 * ((x - 0.052) / 0.056) ** 2, 90 + 6 * (x - 0.052) / 0.056), 0.022, nt=10, na=12),
     "head", "gun", "cheek_L", solid=0.012, bevel=0.002)
part(hshell(0.030, 0.050, lambda x: (brow(x) + 16, 282), 0.024, nt=3, na=20), "head", "gun", "strake_L", solid=0.01, bevel=0.002)
part(hshell(-0.012, 0.012, lambda x: (106, 284), lambda x: 0.034 - 0.12 * x * x, nt=4, na=24), "head", "steel", "crest",
     solid=0.012, bevel=0.002, mirror=False)
part(lathe((0.098, -0.02, 2.13), (1, 0, 0), (0, -1, 0),
           [(0, 0), (0, 0.046), (0.012, 0.048), (0.018, 0.041), (0.02, 0.033), (0.026, 0.029), (0.03, 0.017), (0.032, 0)], 28),
     "head", "steel", "temple_L", sharp=30)
part(lathe((0.127, -0.02, 2.13), (1, 0, 0), (0, -1, 0), [(-0.002, 0), (-0.002, 0.031), (0.003, 0.031), (0.004, 0.022), (0.004, 0)], 28),
     "head", "bronze", "temple_ring_L", sharp=30)
for k in range(4):
    a = 294 + k * 9
    part(hshell(-0.07, 0.07, lambda x, a=a: (a, a + 5), 0.004 + 0.002 * k, nt=10, na=3), "head", "mech", f"head_vent{k}",
         solid=0.006, mirror=False)
# jaw hinge
joint((0.084, -0.035, 2.06), (1, 0, 0), 0.016, 0.02, "jaw", up=(0, -1, 0))


# eyes: glowing almond lenses inside the visor slit + dark sockets
def eye_part(x0, x1, scale, of_add, mat, bone, name, lens):
    def R(t):
        return (0.0085 * scale * math.sin(math.pi * t) ** 0.6 + 0.0008, 0.0035 * scale + 0.001)

    def O(t):
        x = x0 + (x1 - x0) * t
        k = hk(x)
        a = rad(92)
        return (math.cos(a) * HH * k - (t - 0.3) * 0.012, math.sin(a) * HD * k + of_add)
    part(surf((x0, HC.y, HC.z), (x1, HC.y, HC.z), FWD, R, O=O, nt=12, na=16), bone, mat, name, sharp=70 if lens else 40)


eye_part(0.010, 0.072, 1.9, 0.001, "rubber", "head", "eye_socket_L", False)
eye_part(0.018, 0.064, 1.0, 0.007, "eye", "eye_L", "eye_L", True)

# =========================================================== arms (left) ===
UA, FA, HA = "upperarm_L", "forearm_L", "hand_L"
X = lambda x: ((x, 0.01, 1.77))


def armsurf(x0, x1, R, **kw):
    return surf((x0, 0.01, 1.77), (x1, 0.01, 1.77), FWD, R, **kw)  # s = down, f = front, 180 = up, 270 = back


# shoulder / pauldron (3 layered shells)
part(armsurf(0.17, 0.40, [(0, (0.07, 0.08)), (0.35, (0.105, 0.10)), (0.7, (0.095, 0.09)), (1, (0.07, 0.07))], N=2.2, nt=12, na=24),
     UA, "mech", "deltoid_core_L")
part(armsurf(0.18, 0.37, [(0, (0.10, 0.11)), (0.4, (0.135, 0.13)), (1, (0.125, 0.12))], O=(-0.012, 0),
             A=[(0, (95, 265)), (0.25, (48, 318)), (1, (45, 315))], nt=14, na=26), UA, "gun", "pauldron1_L", solid=0.018, bevel=0.003)
part(armsurf(0.30, 0.43, [(0, (0.128, 0.126)), (1, (0.108, 0.108))], O=(-0.006, 0), A=[(0, (55, 305)), (1, (62, 298))], nt=8, na=24),
     UA, "steel", "pauldron2_L", solid=0.014, bevel=0.003)
part(armsurf(0.39, 0.47, [(0, (0.103, 0.10)), (1, (0.088, 0.09))], O=(-0.004, 0), A=[(0, (68, 292)), (1, (74, 286))], nt=6, na=22),
     UA, "gun", "pauldron3_L", solid=0.012, bevel=0.0025)
part(armsurf(0.22, 0.36, lin((0.150, 0.15), (0.146, 0.145)), O=(-0.012, 0), A=(170, 190), nt=8, na=3), UA, "steel",
     "pauldron_ridge_L", solid=0.012, bevel=0.002)
for x in (0.24, 0.29, 0.34):
    bolt((x, 0.01, 1.77 + 0.148), (0, 0, 1), 0.007, UA)
joint((0.22, 0.01, 1.77), (0, 1, 0), 0.07, 0.10, "clavicle_L", "mech")
# upper arm
UA_R = [(0, (0.075, 0.075)), (0.3, (0.08, 0.083)), (0.75, (0.066, 0.068)), (1, (0.056, 0.058))]


def uaR(x, add):
    rs, rf = cr(UA_R, (x - 0.36) / 0.24)
    return (rs + add, rf + add)


def UAS(x0, x1, add, **kw):
    return armsurf(x0, x1, lambda t: uaR(x0 + (x1 - x0) * t, cr(add, t)), **kw)


part(armsurf(0.36, 0.60, UA_R, N=2.3, nt=12, na=24), UA, "mech", "upperarm_core_L")
part(UAS(0.40, 0.57, lambda t: 0.016 + 0.008 * math.sin(math.pi * t), A=[(0, (62, 118)), (0.5, (48, 132)), (1, (66, 114))], nt=10, na=12),
     UA, "gun", "bicep_L", solid=0.014, bevel=0.003)
part(UAS(0.44, 0.58, 0.012, A=[(0, (240, 300)), (1, (236, 304))], nt=8, na=10), UA, "gun", "tricep2_L", solid=0.012, bevel=0.0025)
part(UAS(0.40, 0.50, 0.026, A=[(0, (236, 306)), (1, (240, 300))], nt=6, na=10), UA, "gun", "tricep1_L", solid=0.012, bevel=0.0025)
part(UAS(0.43, 0.58, 0.02, A=[(0, (155, 210)), (1, (160, 205))], nt=8, na=8), UA, "steel", "outerarm_L", solid=0.012, bevel=0.0025)
piston((0.41, -0.075, 1.735), (0.58, -0.055, 1.75), 0.011, UA)
part(tube(((0.40, 0.01, 1.70), (0.50, 0.012, 1.705), (0.61, 0.03, 1.72), (0.68, 0.03, 1.715)), 0.009, 8, rib=0.12, ribf=500),
     grad(0, [(0.57, UA), (0.63, FA)]), "bronze", "arm_cable_L", sharp=60)
# elbow
joint((0.60, 0.01, 1.77), (0, 0, 1), 0.052, 0.10, UA, "steel")
part(armsurf(0.555, 0.665, [(0, (0.055, 0.07)), (0.5, (0.07, 0.086)), (1, (0.06, 0.07))], A=[(0, (238, 302)), (0.5, (222, 318)), (1, (244, 296))],
             nt=8, na=12), FA, "gun", "couter_L", solid=0.016, bevel=0.003)
# forearm
FA_R = [(0, (0.058, 0.06)), (0.2, (0.075, 0.072)), (0.55, (0.068, 0.062)), (1, (0.046, 0.045))]


def FAS(x0, x1, add, **kw):
    return armsurf(x0, x1, lambda t: tuple(v + cr(add, t) for v in cr(FA_R, (x0 + (x1 - x0) * t - 0.60) / 0.33)), **kw)


part(armsurf(0.60, 0.93, FA_R, N=2.4, nt=14, na=24), FA, "mech", "forearm_core_L")
part(FAS(0.63, 0.90, lambda t: 0.014 + 0.01 * math.sin(math.pi * t), A=[(0, (150, 210)), (0.5, (128, 232)), (1, (150, 210))], nt=12, na=14),
     FA, "gun", "forearm_top_L", solid=0.016, bevel=0.003)
part(FAS(0.66, 0.88, 0.03, A=[(0, (170, 190)), (0.5, (165, 195)), (1, (172, 188))], nt=8, na=4), FA, "steel", "forearm_ridge_L",
     solid=0.012, bevel=0.002)
part(FAS(0.66, 0.89, 0.016, A=[(0, (72, 118)), (1, (76, 112))], nt=8, na=10), FA, "steel", "forearm_front_L", solid=0.012, bevel=0.0025)
part(FAS(0.64, 0.87, 0.016, A=[(0, (244, 300)), (1, (248, 296))], nt=8, na=10), FA, "gun", "forearm_back_L", solid=0.012, bevel=0.0025)
for k, dy in enumerate((-0.03, 0.0, 0.03)):
    part(tube(((0.64, 0.01 + dy, 1.705), (0.78, 0.01 + dy * 1.1, 1.712), (0.91, 0.005 + dy * 0.8, 1.73)), 0.0075, 8, rib=0.15, ribf=600),
         FA, "bronze" if k != 1 else "rubber", f"forearm_cable{k}_L", sharp=60)
part(lathe((0.895, 0.007, 1.77), (1, 0, 0), FWD, [(0, 0.05), (0.004, 0.056), (0.016, 0.056), (0.02, 0.05), (0.024, 0.05), (0.028, 0.054),
                                                  (0.04, 0.054), (0.044, 0.047), (0.044, 0.035), (0, 0.035), (0, 0.05)], 28), FA, "steel", "wrist_ring_L", sharp=30)

# ------------------------------------------------------------- hand (L) ---
UP = (0, 0, 1)


def handsurf(x0, x1, R, **kw):
    return surf((x0, 0.004, 1.77), (x1, 0.0, 1.768), UP, R, **kw)  # f = up(90), s = front(0), 270 = palm


PALM_R = [(0, (0.042, 0.026)), (0.4, (0.052, 0.028)), (1, (0.054, 0.022))]
part(handsurf(0.925, 1.052, PALM_R, N=3.0, nt=10, na=24), HA, "mech", "palm_core_L")
part(handsurf(0.935, 1.05, lambda t: tuple(v + 0.008 for v in cr(PALM_R, 0.08 + 0.92 * t)), A=[(0, (50, 130)), (0.5, (30, 150)), (1, (35, 145))],
              N=3.0, nt=10, na=14), HA, "gun", "handback_L", solid=0.01, bevel=0.002)
part(handsurf(0.96, 1.04, lambda t: tuple(v + 0.016 for v in cr(PALM_R, 0.3 + 0.7 * t)), A=[(0, (80, 100)), (1, (60, 120))], N=3.0, nt=6, na=8),
     HA, "steel", "handback2_L", solid=0.008, bevel=0.002)
part(handsurf(0.93, 1.05, lambda t: tuple(v + 0.004 for v in cr(PALM_R, t)), A=[(0, (225, 315)), (1, (215, 325))], N=3.0, nt=8, na=12),
     HA, "rubber", "palm_pad_L", solid=0.008, bevel=0.002)


def bone_vec(n):
    for (bn, h, t, par, roll, de) in BONES:
        if bn == n:
            return h, t, roll
    raise KeyError(n)


def digit(prefix, r0, upv, claw=True):
    for i in range(3):
        bn = f"{prefix}_0{i+1}_L"
        h, t, _ = bone_vec(bn)
        d = (t - h)
        L = d.length
        rr = r0 * (1 - 0.12 * i)
        part(surf(h, t + d.normalized() * 0.004, upv, lin((rr, rr * 0.95), (rr * 0.88, rr * 0.85)), N=2.4, nt=4, na=14), bn, "mech", f"{bn}_core")
        part(surf(h + d * 0.12, t + d.normalized() * (0.002 if i < 2 else 0.006), upv,
                  lin((rr * 1.28, rr * 1.25), (rr * 1.12, rr * 1.12)), A=[(0, (28, 152)), (1, (34, 146))], O=lin((0, 0.001), (0, 0.002)),
                  nt=4, na=10), bn, "gun" if i != 1 else "steel", f"{bn}_shell", solid=0.004, bevel=0.0012)
        side = d.normalized().cross(Vector(upv)).normalized()
        joint(h, side, rr * 1.05, rr * 2.0, bn if i else HA, "steel", up=upv)
        if i == 2 and claw:
            dn = d.normalized()
            e = t + dn * 0.004
            part(surf(e, e + dn * 0.028, upv, [(0, (rr * 0.9, rr * 0.95)), (0.5, (rr * 0.55, rr * 0.7)), (1, (0.0006, 0.0008))],
                      O=lambda tt: (0, -0.012 * tt * tt), N=2.6, nt=8, na=12), bn, "chrome", f"{bn}_claw")


for fn in FINGERS:
    digit(fn, 0.0115 if fn != "pinky" else 0.0098, UP)
    h, _, _ = bone_vec(f"{fn}_01_L")
    part(lathe(h + Vector((-0.004, 0, 0.012)), (0, 0, 1), FWD, [(0, 0), (0, 0.015), (0.006, 0.014), (0.01, 0.009), (0.012, 0)], 14),
         HA, "steel", f"knuckle_{fn}_L", sharp=30)
digit("thumb", 0.0135, (0.3, -0.3, 0.9))

# ============================================================ legs (left) ===
TH, SH, FT, BL = "thigh_L", "shin_L", "foot_L", "ball_L"
part(lathe((0.115, 0, 1.08), (1, 0, 0), FWD, [(-0.075, 0), (-0.07, 0.03), (-0.05, 0.06), (-0.02, 0.075), (0.02, 0.075), (0.05, 0.06),
                                              (0.07, 0.03), (0.075, 0)], 24), TH, "mech", "hip_ball_L", sharp=50)
TH_P0, TH_P1 = Vector((0.11, 0.0, 1.14)), Vector((0.13, -0.015, 0.62))  # s = inside (-X), f = front, 180 = outside, 270 = back
TH_R = [(0, (0.09, 0.095)), (0.2, (0.105, 0.11)), (0.55, (0.09, 0.10)), (0.9, (0.07, 0.075)), (1, (0.065, 0.07))]


def THS(t0, t1, add, **kw):
    a, b = TH_P0.lerp(TH_P1, t0), TH_P0.lerp(TH_P1, t1)
    return surf(a, b, FWD, lambda t: tuple(v + cr(add, t) for v in cr(TH_R, t0 + (t1 - t0) * t)), **kw)


part(surf(TH_P0, TH_P1, FWD, TH_R, N=2.2, nt=16, na=26), TH, "mech", "thigh_core_L")
part(THS(0.08, 0.55, lambda t: 0.018 + 0.012 * math.sin(math.pi * t), A=[(0, (70, 115)), (0.5, (45, 140)), (1, (60, 125))], nt=12, na=14),
     TH, "gun", "quad_upper_L", solid=0.016, bevel=0.003)
part(THS(0.45, 0.93, lambda t: 0.03 + 0.008 * math.sin(math.pi * t), A=[(0, (55, 130)), (0.7, (66, 120)), (1, (82, 104))], nt=12, na=12),
     TH, "steel", "quad_lower_L", solid=0.014, bevel=0.003)
part(THS(0.10, 0.75, 0.02, A=[(0, (152, 210)), (0.5, (148, 216)), (1, (156, 206))], nt=12, na=10), TH, "gun", "thigh_outer_L",
     solid=0.014, bevel=0.003)
part(THS(0.15, 0.80, lambda t: 0.016 + 0.01 * math.sin(math.pi * t), A=[(0, (238, 300)), (0.5, (232, 306)), (1, (242, 298))], nt=12, na=10),
     TH, "gun", "hamstring_L", solid=0.014, bevel=0.003)
part(THS(0.20, 0.70, 0.004, A=[(0, (-22, 20)), (1, (-18, 16))], nt=8, na=8), TH, "rubber", "inner_thigh_pad_L", solid=0.006, bevel=0.002)
piston((0.212, 0.0, 1.02), (0.19, 0.0, 0.68), 0.014, TH)
for k, dx in enumerate((-0.025, 0.0, 0.025)):
    part(tube(((0.06 + dx * 0.3, 0.03 + dx, 1.05), (0.045, 0.02 + dx, 0.85), (0.08, 0.02 + dx, 0.66)), 0.0085, 8, rib=0.12, ribf=500),
         TH, "bronze", f"thigh_cable{k}_L", sharp=60)
# knee
joint((0.13, -0.015, 0.60), (1, 0, 0), 0.062, 0.13, SH, "steel")
part(surf((0.13, -0.02, 0.71), (0.135, -0.03, 0.52), FWD, [(0, (0.055, 0.07)), (0.5, (0.075, 0.092)), (1, (0.05, 0.068))],
          A=[(0, (62, 118)), (0.5, (38, 142)), (1, (70, 110))], nt=10, na=14), SH, "gun", "kneecap_L", solid=0.02, bevel=0.003)
part(surf((0.13, -0.03, 0.68), (0.135, -0.035, 0.56), FWD, [(0, (0.05, 0.095)), (0.5, (0.06, 0.106)), (1, (0.045, 0.09))],
          A=[(0, (72, 108)), (0.5, (60, 120)), (1, (78, 102))], nt=8, na=10), SH, "steel", "kneecap2_L", solid=0.014, bevel=0.003)
# shin
SH_P0, SH_P1 = Vector((0.13, -0.015, 0.60)), Vector((0.14, 0.015, 0.11))
SH_R = [(0, (0.065, 0.07)), (0.2, (0.072, 0.088)), (0.45, (0.062, 0.075)), (0.8, (0.046, 0.05)), (1, (0.042, 0.045))]
SH_O = [(0, (0, 0)), (0.2, (0, -0.02)), (0.5, (0, -0.012)), (1, (0, 0))]


def SHS(t0, t1, add, **kw):
    a, b = SH_P0.lerp(SH_P1, t0), SH_P0.lerp(SH_P1, t1)
    return surf(a, b, FWD, lambda t: tuple(v + cr(add, t) for v in cr(SH_R, t0 + (t1 - t0) * t)),
                O=lambda t: cr(SH_O, t0 + (t1 - t0) * t), **kw)


part(surf(SH_P0, SH_P1, FWD, SH_R, O=SH_O, N=2.2, nt=16, na=26), SH, "mech", "shin_core_L")
part(SHS(0.06, 0.92, lambda t: 0.016 + 0.006 * math.sin(math.pi * t), A=[(0, (48, 132)), (0.3, (58, 122)), (1, (68, 112))], nt=16, na=14),
     SH, "gun", "shinguard_L", solid=0.016, bevel=0.003)
part(SHS(0.10, 0.85, 0.03, A=[(0, (84, 96)), (0.5, (82, 98)), (1, (85, 95))], nt=12, na=4), SH, "steel", "shin_ridge_L", solid=0.012, bevel=0.002)
part(SHS(0.10, 0.46, lambda t: 0.022 + 0.01 * math.sin(math.pi * t), A=[(0, (222, 318)), (0.5, (214, 326)), (1, (230, 310))], nt=10, na=14),
     SH, "gun", "calf1_L", solid=0.014, bevel=0.003)
part(SHS(0.36, 0.66, 0.014, A=[(0, (232, 308)), (1, (240, 300))], nt=8, na=10), SH, "gun", "calf2_L", solid=0.012, bevel=0.0025)
part(SHS(0.12, 0.70, 0.02, A=[(0, (150, 205)), (1, (156, 200))], nt=10, na=8), SH, "steel", "shin_outer_L", solid=0.012, bevel=0.0025)
piston((0.14, 0.055, 0.44), (0.14, 0.07, 0.13), 0.012, SH)
for k, dx in enumerate((-0.02, 0.02)):
    part(tube(((0.13 + dx, 0.03, 0.52), (0.135 + dx * 1.5, 0.06, 0.32), (0.14 + dx, 0.05, 0.14)), 0.0075, 8, rib=0.12, ribf=600),
         SH, "bronze", f"calf_cable{k}_L", sharp=60)
joint((0.14, 0.015, 0.10), (1, 0, 0), 0.045, 0.11, SH, "steel")
# foot (f = up, s = inside, 180 = outside, 270 = sole)
FT_R = [(0, (0.045, 0.05)), (0.3, (0.055, 0.062)), (0.6, (0.058, 0.05)), (1, (0.055, 0.026))]
FT_O = [(0, (0, 0.055)), (0.3, (0, 0.064)), (0.6, (0, 0.05)), (1, (0, 0.028))]


def FTS(t0, t1, add, **kw):
    return surf((0.14, 0.075 - 0.18 * t0, 0), (0.14, 0.075 - 0.18 * t1, 0), UP,
                lambda t: tuple(v + cr(add, t) for v in cr(FT_R, t0 + (t1 - t0) * t)), O=lambda t: cr(FT_O, t0 + (t1 - t0) * t), **kw)


part(FTS(0, 1, 0.0, N=2.8, nt=12, na=24), FT, "mech", "foot_core_L")
for k, (t0, t1) in enumerate(((0.05, 0.45), (0.38, 0.75), (0.68, 1.0))):
    part(FTS(t0, t1, 0.012 + 0.006 * k, A=[(0, (40, 140)), (1, (34, 146))], N=2.8, nt=6, na=14), FT, ["gun", "steel", "gun"][k],
         f"instep{k}_L", solid=0.012, bevel=0.0025)
part(FTS(0, 1, 0.006, A=(222, 318), N=2.8, nt=12, na=10), FT, "rubber", "sole_L", solid=0.012, bevel=0.002)
part(surf((0.14, 0.06, 0.012), (0.14, 0.06, 0.15), (0, 1, 0), [(0, (0.05, 0.035)), (0.6, (0.054, 0.045)), (1, (0.04, 0.03))],
          A=(10, 170), nt=8, na=14), FT, "gun", "heel_L", solid=0.016, bevel=0.003)
part(surf((0.14, 0.09, 0.02), (0.14, 0.12, 0.012), UP, lin((0.018, 0.014), (0.004, 0.004)), N=2.5, nt=4, na=10), FT, "steel", "heel_spur_L")
# toes: three segmented toe caps on the ball bone
for k, dx in enumerate((-0.034, 0.0, 0.034)):
    x = 0.14 + dx
    y0 = -0.10
    part(surf((x, y0, 0.0), (x, y0 - 0.10 + abs(dx) * 0.5, 0.0), UP, [(0, (0.017, 0.022)), (0.7, (0.016, 0.017)), (1, (0.005, 0.005))],
              O=[(0, (0, 0.026)), (1, (0, 0.012))], N=2.6, nt=8, na=14), BL, "mech", f"toe_core{k}_L")
    part(surf((x, y0 + 0.005, 0.0), (x, y0 - 0.095 + abs(dx) * 0.5, 0.0), UP, [(0, (0.021, 0.025)), (0.7, (0.02, 0.021)), (1, (0.008, 0.007))],
              O=[(0, (0, 0.028)), (1, (0, 0.013))], A=[(0, (20, 160)), (1, (10, 170))], nt=8, na=10), BL, "steel" if k == 1 else "gun",
         f"toe_cap{k}_L", solid=0.006, bevel=0.0015)
joint((0.14, -0.10, 0.03), (1, 0, 0), 0.024, 0.11, BL, "steel")

# ============================================================ assemble ======
print("parts:", len(ALL))
bpy.ops.object.select_all(action="DESELECT")
for ob in ALL:
    ob.select_set(True)
bpy.context.view_layer.objects.active = ALL[0]
bpy.ops.object.join()
BODY = bpy.context.view_layer.objects.active
BODY.name = BODY.data.name = "Sentinel_Body"
COL.objects.link(BODY)
WORK.objects.unlink(BODY)

# merge duplicated materials into clean slots
mats = []
for m in BODY.data.materials:
    if m not in mats:
        mats.append(m)
remap = [mats.index(m) for m in BODY.data.materials]
idx = np.zeros(len(BODY.data.polygons), dtype=np.int32)
BODY.data.polygons.foreach_get("material_index", idx)
idx = np.array(remap)[idx].astype(np.int32)
BODY.data.materials.clear()
for m in mats:
    BODY.data.materials.append(m)
BODY.data.polygons.foreach_set("material_index", idx)

# world-space box-projection UVs (texel density ~1700 px / m, tileable maps)
TILE = 0.45
bm = bmesh.new()
bm.from_mesh(BODY.data)
uv = bm.loops.layers.uv.verify()
for f in bm.faces:
    n = f.normal
    ax = max(range(3), key=lambda i: abs(n[i]))
    a, b = [(1, 2), (0, 2), (0, 1)][ax]
    for l in f.loops:
        co = l.vert.co
        l[uv].uv = (co[a] / TILE + (0.37 if ax == 0 else 0), co[b] / TILE + (0.61 if ax == 1 else 0))
bm.to_mesh(BODY.data)
bm.free()

BODY.parent = ARM
md = BODY.modifiers.new("Armature", "ARMATURE")
md.object = ARM
for c in list(WORK.objects):
    bpy.data.objects.remove(c)
bpy.data.collections.remove(WORK)

# normalise weights (sum 1, max 4 influences)
for v in BODY.data.vertices:
    gs = sorted(v.groups, key=lambda g: -g.weight)
    keep = gs[:4]
    tot = sum(g.weight for g in keep) or 1
    for g in gs[4:]:
        BODY.vertex_groups[g.group].remove([v.index])
    for g in keep:
        BODY.vertex_groups[g.group].add([v.index], g.weight / tot, "REPLACE")

tris = sum(len(p.vertices) - 2 for p in BODY.data.polygons)
print("verts", len(BODY.data.vertices), "tris", tris)

# ========================================================== animations =====
REST = {b.name: b.matrix_local.to_3x3() for b in ARM.data.bones}
RDIR = {b.name: (b.tail_local - b.head_local).normalized() for b in ARM.data.bones}
DEF_BONES = [b.name for b in ARM.data.bones if b.use_deform]


def mir(v):
    return (-v[0], v[1], v[2])


def q_of(bn, ops):
    q = Quaternion()
    for op in ops:
        if op[0] == "b":  # bend toward a world (rest-space) direction
            axis = RDIR[bn].cross(Vector(op[1]))
            if axis.length < 1e-6:
                continue
            la = (REST[bn].inverted() @ axis.normalized()).normalized()
            q = Quaternion(la, rad(op[2])) @ q
        elif op[0] == "t":  # twist about the bone
            q = Quaternion((0, 1, 0), rad(op[1])) @ q
    return q


def sym(spec):
    out = {}
    for bn, ops in spec.items():
        out[bn] = ops
        if bn.endswith("_L"):
            out[bn[:-2] + "_R"] = [("b", mir(o[1]), o[2]) if o[0] == "b" else ("t", -o[1]) for o in ops]
    return out


def merge(*specs):
    out = {}
    for s in specs:
        for k, v in s.items():
            out.setdefault(k, [])
            out[k] = out[k] + list(v)
    return out


def finger_curl(side, amt, thumb=None):
    sp = {}
    for fn in FINGERS:
        for i in range(3):
            sp[f"{fn}_0{i+1}_{side}"] = [("b", (0, 0, -1), amt * (1.0 if i else 0.85))]
    ta = amt if thumb is None else thumb
    for i in range(3):
        sp[f"thumb_0{i+1}_{side}"] = [("b", ((0.3 if side == "L" else -0.3), 0.6, -0.7), ta * 0.6)]
    return sp


def base_arms(down=72, elbow=14, curl=14):
    return merge(sym({"upperarm_L": [("b", (0, 0, -1), down)], "forearm_L": [("b", (0, -1, 0), elbow)],
                      "hand_L": [("t", -10)]}), finger_curl("L", curl), finger_curl("R", curl))


def key(frame, spec, hips_z=0.0, hips_y=0.0):
    for pb in ARM.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    for bn, ops in spec.items():
        if bn in ARM.pose.bones:
            ARM.pose.bones[bn].rotation_quaternion = q_of(bn, ops)
    # hips local Y = world up, local Z = world -Y
    ARM.pose.bones["hips"].location = (0, hips_z, -hips_y)
    for bn in DEF_BONES:
        pb = ARM.pose.bones[bn]
        pb.keyframe_insert("rotation_quaternion", frame=frame, group=bn)
    ARM.pose.bones["hips"].keyframe_insert("location", frame=frame, group="hips")


ARM.animation_data_create()
ACTIONS = []


def action(name, frames, fn, cyclic=False):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ARM.animation_data.action = act
    for f in frames:
        fn(f)
    act.use_frame_range = True
    act.frame_range = (frames[0], frames[-1])
    act.use_cyclic = cyclic
    ACTIONS.append(act)
    return act


def idle(f):
    ph = 2 * math.pi * (f - 1) / 80
    br = math.sin(ph)
    sp = merge(base_arms(70 + 1.5 * br, 14 + 2 * br, 14),
               {"spine_02": [("b", (0, 1, 0), 1.2 * br)], "spine_03": [("b", (0, 1, 0), 1.0 * br)],
                "neck_01": [("t", 4 * math.sin(ph * 0.5))], "head": [("b", (0, -1, 0), 3 + br), ("t", 6 * math.sin(ph * 0.5))]})
    key(f, sp, hips_z=-0.004 * (1 + br))


def gait(f, period, stride, knee, armsw, lean, bob, elbow, curl):
    ph = 2 * math.pi * (f - 1) / period
    s = math.sin(ph)
    c = math.cos(ph)
    sp = merge(base_arms(74, elbow, curl),
               {"thigh_L": [("b", (0, -1, 0), stride * s)], "thigh_R": [("b", (0, -1, 0), -stride * s)],
                "shin_L": [("b", (0, 1, 0), 6 + knee * max(0.0, -c) ** 1.5 + 8 * max(0.0, s))],
                "shin_R": [("b", (0, 1, 0), 6 + knee * max(0.0, c) ** 1.5 + 8 * max(0.0, -s))],
                "foot_L": [("b", (0, 0, -1), -8 * s)], "foot_R": [("b", (0, 0, -1), 8 * s)],
                "upperarm_L": [("b", (0, -1, 0), -armsw * s)], "upperarm_R": [("b", (0, -1, 0), armsw * s)],
                "spine_01": [("b", (0, -1, 0), lean * 0.4), ("t", 4 * s)], "spine_02": [("b", (0, -1, 0), lean * 0.3)],
                "spine_03": [("t", -6 * s), ("b", (0, -1, 0), lean * 0.3)], "head": [("t", 3 * s), ("b", (0, 1, 0), lean * 0.6)],
                "hips": [("t", -5 * s)]})
    key(f, sp, hips_z=-bob * (0.5 - 0.5 * math.cos(2 * ph)))


def punch(f):
    g = merge(base_arms(60, 100, 80),
              {"upperarm_L": [("b", (0, -1, 0), 55)], "upperarm_R": [("b", (0, -1, 0), 55)],
               "thigh_L": [("b", (0, -1, 0), 18)], "thigh_R": [("b", (0, 1, 0), 12)],
               "shin_L": [("b", (0, 1, 0), 22)], "shin_R": [("b", (0, 1, 0), 20)], "spine_01": [("t", 12)],
               "spine_03": [("b", (0, -1, 0), 6)], "head": [("b", (0, 1, 0), 4)]})
    if 10 <= f <= 22:  # right cross
        k = math.sin(math.pi * (f - 10) / 12)
        g = merge(g, {"upperarm_R": [("b", (0, -1, 0), 35 * k), ("b", (0, 0, 1), 20 * k)], "forearm_R": [("b", (0, 1, 0), 95 * k)],
                      "spine_01": [("t", -30 * k)], "spine_02": [("t", -12 * k)], "thigh_R": [("t", -10 * k)]})
    if 24 <= f <= 36:  # left claw swipe
        k = math.sin(math.pi * (f - 24) / 12)
        g = merge(g, {"upperarm_L": [("b", (0, 0, 1), 40 * k), ("b", (0, -1, 0), 20 * k)], "forearm_L": [("b", (0, 1, 0), 60 * k)],
                      "spine_01": [("t", 30 * k)]}, finger_curl("L", -60 * k))
    key(f, g, hips_z=-0.05)


def talk(f):
    ph = f / 24.0
    jaw = max(0.0, math.sin(ph * 9.0) * 0.6 + math.sin(ph * 13.7) * 0.4) * 14
    sp = merge(base_arms(68, 30, 18),
               {"jaw": [("b", (0, 0, -1), jaw)], "head": [("b", (0, -1, 0), 3 * math.sin(ph * 2.1)), ("t", 8 * math.sin(ph * 1.3))],
                "neck_02": [("b", (0, 0, 1), 2 * math.sin(ph * 1.7))],
                "upperarm_R": [("b", (0, -1, 0), 25 + 10 * math.sin(ph * 2.5))], "forearm_R": [("b", (0, -1, 0), 50 + 15 * math.sin(ph * 3.1))],
                "hand_R": [("t", 40 + 20 * math.sin(ph * 2))]}, finger_curl("R", -10 + 20 * (0.5 + 0.5 * math.sin(ph * 3))))
    key(f, sp)


def look(f):
    ph = 2 * math.pi * (f - 1) / 96
    yaw = 55 * math.sin(ph)
    pitch = 12 * math.sin(2 * ph)
    sp = merge(base_arms(), {"neck_01": [("t", yaw * 0.3)], "neck_02": [("t", yaw * 0.3), ("b", (0, -1, 0), pitch * 0.4)],
                             "head": [("t", yaw * 0.4), ("b", (0, -1, 0), pitch * 0.6)], "spine_03": [("t", yaw * 0.1)],
                             "eye_L": [("t", 0)], })
    key(f, sp)


def fist(f):
    k = math.sin(math.pi * (f - 1) / 40) ** 2
    sp = merge(base_arms(40, 70, 0), {"forearm_L": [("t", -30)], "forearm_R": [("t", 30)]},
               finger_curl("L", 85 * k, 70 * k), finger_curl("R", 85 * k, 70 * k))
    key(f, sp)


def hero(f):
    sp = merge({"upperarm_L": [("b", (0, 0, -1), 58), ("b", (0, -1, 0), 10)], "forearm_L": [("b", (0, -1, 0), 22)],
                "upperarm_R": [("b", (0, 0, -1), 64), ("b", (0, -1, 0), -8)], "forearm_R": [("b", (0, -1, 0), 30)],
                "hand_L": [("t", -25)], "hand_R": [("t", 20)],
                "thigh_L": [("b", (1, 0, 0), 6), ("b", (0, -1, 0), 6)], "thigh_R": [("b", (-1, 0, 0), 7), ("b", (0, 1, 0), 6)],
                "shin_L": [("b", (0, 1, 0), 8)], "shin_R": [("b", (0, 1, 0), 4)],
                "spine_02": [("b", (0, 1, 0), 3)], "spine_03": [("t", 6)], "neck_02": [("b", (0, -1, 0), 6)],
                "head": [("b", (0, -1, 0), 10), ("t", -14)], "jaw": [("b", (0, 0, -1), 2)]},
               finger_curl("L", 38, 20), finger_curl("R", 55, 30))
    key(f, sp, hips_z=-0.01)


def menace(f):
    k = min(1.0, (f - 1) / 20)
    sp = merge(sym({"upperarm_L": [("b", (0, 0, -1), 30 * k + 20), ("b", (0, -1, 0), 25 * k)], "forearm_L": [("b", (0, -1, 0), 45 * k)],
                    "hand_L": [("b", (0, 0, 1), 20 * k)], "thigh_L": [("b", (1, 0, 0), 9 * k)], "shin_L": [("b", (0, 1, 0), 12 * k)]}),
               {"spine_03": [("b", (0, -1, 0), 10 * k)], "head": [("b", (0, 1, 0), 8 * k)], "jaw": [("b", (0, 0, -1), 6 * k)]},
               finger_curl("L", 25 * k, 10 * k), finger_curl("R", 25 * k, 10 * k))
    key(f, sp, hips_z=-0.04 * k)


action("Idle", list(range(1, 82, 4)), idle, cyclic=True)
action("Walk", list(range(1, 34, 2)), lambda f: gait(f, 32, 26, 50, 22, 4, 0.03, 18, 16), cyclic=True)
action("Run", list(range(1, 22)), lambda f: gait(f, 20, 42, 85, 45, 14, 0.06, 85, 60), cyclic=True)
action("Combat_Combo", list(range(1, 41, 1)), punch)
action("Talk", list(range(1, 97, 2)), talk, cyclic=True)
action("Head_Look", list(range(1, 98, 4)), look, cyclic=True)
action("Hand_Fist", list(range(1, 42, 2)), fist, cyclic=True)
action("Pose_Hero", [1, 2], hero)
action("Pose_Menace", list(range(1, 32, 3)), menace)
ARM.animation_data.action = bpy.data.actions["Idle"]
for act in ACTIONS:  # NLA tracks keep every action discoverable by exporters / engines
    tr = ARM.animation_data.nla_tracks.new()
    tr.name = act.name
    st = tr.strips.new(act.name, int(act.frame_range[0]), act)
    tr.mute = True
SCN.frame_start, SCN.frame_end = 1, 81
SCN.render.fps = 24
print("actions:", [a.name for a in ACTIONS])

# ============================================================== save / export
os.makedirs(os.path.join(ROOT, "source"), exist_ok=True)
os.makedirs(os.path.join(ROOT, "export"), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "source", "sentinel.blend"), compress=True)


def select_char(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = ARM


select_char([ARM, BODY])
GLTF_KW = dict(export_format="GLB", use_selection=True, export_animation_mode="ACTIONS", export_def_bones=True,
               export_image_format="JPEG", export_jpeg_quality=90, export_yup=True, export_skins=True,
               export_all_influences=False, export_force_sampling=True, export_optimize_animation_size=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, "export", "sentinel.glb"), **GLTF_KW)
bpy.ops.export_scene.fbx(filepath=os.path.join(ROOT, "export", "sentinel.fbx"), use_selection=True, object_types={"ARMATURE", "MESH"},
                         add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
                         path_mode="COPY", embed_textures=True, use_armature_deform_only=True, mesh_smooth_type="FACE",
                         apply_scale_options="FBX_SCALE_ALL", primary_bone_axis="Y", secondary_bone_axis="X")

# LOD1 (game runtime): decimated copy
lod = BODY.copy()
lod.data = BODY.data.copy()
lod.name = "Sentinel_Body_LOD1"
COL.objects.link(lod)
dm = lod.modifiers.new("dec", "DECIMATE")
dm.ratio = 0.3
bpy.ops.object.select_all(action="DESELECT")
lod.select_set(True)
bpy.context.view_layer.objects.active = lod
bpy.ops.object.modifier_move_to_index(modifier="dec", index=0)
bpy.ops.object.modifier_apply(modifier="dec")
print("LOD1 tris", sum(len(p.vertices) - 2 for p in lod.data.polygons))
BODY.hide_set(True)
select_char([ARM, lod])
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, "export", "sentinel_lod1.glb"), **GLTF_KW)
BODY.hide_set(False)
lod.hide_set(True)
lod.hide_render = True
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "source", "sentinel.blend"), compress=True)
print("DONE")
