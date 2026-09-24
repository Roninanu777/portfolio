# Royal Enfield Interceptor 650 (Black Ray), built from primitives.
# Axes: +X forward, +Z up, Y lateral (+Y = right side). Units: metres.
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------- materials
def material(name, color, metal=0.0, rough=0.5, coat=0.0, emit=None, emit_k=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.04
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_k
    return m

M = {}
def make_materials():
    M['paint'] = material('paint', (0.008, 0.008, 0.009), 0.2, 0.28, coat=1.0)
    M['black'] = material('satin black', (0.02, 0.02, 0.022), 0.6, 0.42)
    M['engine'] = material('engine', (0.03, 0.03, 0.032), 0.8, 0.38)
    M['fin'] = material('fin edge', (0.35, 0.35, 0.36), 1.0, 0.25)
    M['chrome'] = material('chrome', (0.9, 0.9, 0.92), 1.0, 0.06)
    M['rubber'] = material('rubber', (0.006, 0.006, 0.006), 0.0, 0.9)
    M['seat'] = material('seat', (0.012, 0.011, 0.011), 0.0, 0.6)
    M['glass'] = material('lens', (0.9, 0.9, 0.85), 0.0, 0.05, emit=(1.0, 0.92, 0.75), emit_k=0.0)
    M['tail'] = material('tail', (0.5, 0.02, 0.02), 0.0, 0.2, emit=(1, 0.05, 0.03), emit_k=0.0)
    M['amber'] = material('amber', (0.9, 0.45, 0.05), 0.0, 0.2)
    M['dial'] = material('dial', (0.85, 0.85, 0.82), 0.0, 0.4)
    # rider
    M['jacket'] = material('jacket', (0.01, 0.011, 0.013), 0.0, 0.55)
    M['jeans'] = material('jeans', (0.03, 0.05, 0.09), 0.0, 0.8)
    M['boot'] = material('boot', (0.06, 0.035, 0.02), 0.0, 0.5)
    M['helmet'] = material('helmet', (0.02, 0.02, 0.02), 0.3, 0.2, coat=1.0)
    M['visor'] = material('visor', (0.01, 0.01, 0.012), 0.8, 0.05)
    M['glove'] = material('glove', (0.03, 0.03, 0.03), 0.0, 0.6)

def finish(o, m, smooth=True):
    if o.type == 'MESH':
        o.data.materials.append(m)
        if smooth:
            for p in o.data.polygons: p.use_smooth = True
    else:
        o.data.materials.append(m)
    return o

def active(): return bpy.context.active_object

# ---------- primitives
def cyl(p1, p2, r, m, v=32, r2=None):
    p1, p2 = Vector(p1), Vector(p2); d = p2 - p1
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d.length, location=(p1 + p2) / 2)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, radius2=r2, depth=d.length, location=(p1 + p2) / 2)
    o = active(); o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return finish(o, m)

def sphere(c, s, m, seg=32, ring=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=1, location=c)
    o = active(); o.scale = s
    return finish(o, m)

def capsule(p1, p2, r, m, r2=None):
    cyl(p1, p2, r, m, 24, r2)
    sphere(p1, (r, r, r), m, 20, 10); sphere(p2, ((r2 or r),) * 3, m, 20, 10)

def box(c, s, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = active(); o.scale = s; o.rotation_euler = rot
    if bevel:
        bpy.ops.object.transform_apply(scale=True)
        mod = o.modifiers.new('b', 'BEVEL'); mod.width = bevel; mod.segments = 4
    return finish(o, m)

def torus(c, R, r, m, axis='Y', seg=64, mseg=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=mseg, location=c)
    o = active()
    if axis == 'Y': o.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'X': o.rotation_euler = (0, math.pi / 2, 0)
    return finish(o, m)

def tube(pts, r, m, res=12):
    cu = bpy.data.curves.new('tube', 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = r; cu.bevel_resolution = 4; cu.use_fill_caps = True
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts): p.co = (*q, 1)
    sp.use_endpoint_u = True; sp.order_u = min(4, len(pts)); sp.resolution_u = res
    o = bpy.data.objects.new('tube', cu); bpy.context.collection.objects.link(o)
    cu.materials.append(m)
    return o

def band(center, R, width, a0, a1, thick, m, seg=40):
    """Curved fender: a strip of a cylinder around a wheel axle (XZ plane)."""
    bm = bmesh.new(); cx, cy, cz = center
    rows = []
    for i in range(seg + 1):
        a = math.radians(a0 + (a1 - a0) * i / seg)
        row = []
        for rr in (R, R + thick):
            for y in (-width / 2, width / 2):
                row.append(bm.verts.new((cx + rr * math.cos(a), cy + y, cz + rr * math.sin(a))))
        rows.append(row)
    for i in range(seg):
        a, b = rows[i], rows[i + 1]
        for f in ((a[0], a[1], b[1], b[0]), (a[2], b[2], b[3], a[3]), (a[0], b[0], b[2], a[2]), (a[1], a[3], b[3], b[1])):
            bm.faces.new(f)
    me = bpy.data.meshes.new('band'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('band', me); bpy.context.collection.objects.link(o)
    return finish(o, m)

# ---------- the bike
RA = Vector((0.0, 0, 0.315))    # rear axle
FA = Vector((1.40, 0, 0.315))   # front axle
HEAD = Vector((1.12, 0, 0.93))  # top of the steering head

def wheel(c, tire_r, tire_w, front):
    torus(c, tire_r - tire_w * 0.5, tire_w * 0.52, M['rubber'], 'Y', 72, 20)
    for y in (-0.03, 0.03):                                          # rim lips
        torus(c + Vector((0, y, 0)), 0.228, 0.01, M['black'], 'Y', 72, 10)
    cyl(c + Vector((0, -0.07, 0)), c + Vector((0, 0.07, 0)), 0.055, M['engine'], 32)   # hub
    for k in range(10):                                              # alloy spokes
        a = 2 * math.pi * k / 10 + (0.12 if k % 2 else -0.12)
        p1 = c + Vector((0.05 * math.cos(a), 0, 0.05 * math.sin(a)))
        p2 = c + Vector((0.222 * math.cos(a + (0.06 if k % 2 else -0.06)), 0, 0.222 * math.sin(a + (0.06 if k % 2 else -0.06))))
        cyl(p1, p2, 0.0085, M['black'], 12)
    # brake disc
    side = 0.085 if front else -0.075
    cyl(c + Vector((0, side - 0.003, 0)), c + Vector((0, side + 0.003, 0)), 0.16 if front else 0.13, M['fin'], 48)
    cyl(c + Vector((0, side - 0.004, 0)), c + Vector((0, side + 0.004, 0)), 0.07, M['black'], 32)

def sidecover(s):
    pts = [(0.30, 0.79), (0.60, 0.79), (0.58, 0.60), (0.46, 0.50), (0.33, 0.55)]
    bm = bmesh.new()
    fr = [bm.verts.new((x, s * 0.09, z)) for x, z in pts]
    bk = [bm.verts.new((x, s * 0.145, z)) for x, z in pts]
    bm.faces.new(fr if s < 0 else fr[::-1]); bm.faces.new(bk[::-1] if s < 0 else bk)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        f = (fr[i], fr[j], bk[j], bk[i])
        bm.faces.new(f if s > 0 else f[::-1])
    me = bpy.data.meshes.new('cover'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('cover', me); bpy.context.collection.objects.link(o)
    mod = o.modifiers.new('b', 'BEVEL'); mod.width = 0.025; mod.segments = 5
    finish(o, M['paint'], smooth=True)
    sphere((0.45, s * 0.147, 0.66), (0.05, 0.004, 0.017), M['chrome'], 20, 8)

def build_bike():
    wheel(RA, 0.315, 0.13, False)
    wheel(FA, 0.31, 0.10, True)

    # front fork (raked), black lowers, chrome stanchions
    fork_dir = (HEAD - FA).normalized()
    for y in (-0.095, 0.095):
        low = FA + Vector((0, y, 0)); mid = FA + fork_dir * 0.30 + Vector((0, y, 0)); top = FA + fork_dir * 0.72 + Vector((0, y, 0))
        cyl(low, mid, 0.028, M['black'], 24)
        cyl(mid, top, 0.021, M['chrome'], 24)
    cyl(FA + Vector((0, -0.1, 0)), FA + Vector((0, 0.1, 0)), 0.014, M['chrome'], 16)  # axle
    # triple clamps
    for t in (0.60, 0.72):
        p = FA + fork_dir * t
        box(p, (0.08, 0.26, 0.025), M['black'], 0.008)
    # front fender
    band(FA, 0.35, 0.12, 20, 135, 0.006, M['paint'])
    # brake caliper
    box(FA + Vector((-0.1, 0.09, 0.1)), (0.07, 0.03, 0.05), M['black'], 0.01)

    # headlamp with chrome bezel, twin pods, bars
    hl = FA + fork_dir * 0.64 + Vector((0.09, 0, 0.05))
    sphere(hl, (0.085, 0.085, 0.085), M['black'])
    torus(hl + Vector((0.07, 0, 0)), 0.078, 0.009, M['chrome'], 'X', 48, 10)
    lens = sphere(hl + Vector((0.068, 0, 0)), (0.012, 0.074, 0.074), M['glass'], 32, 12)
    lens.name = 'headlamp_lens'
    for y in (-0.07, 0.07):
        pod = HEAD + Vector((-0.04, y, 0.075))
        cyl(pod + Vector((0.02, 0, -0.03)), pod + Vector((-0.01, 0, 0.02)), 0.046, M['black'], 32)
        cyl(pod + Vector((-0.008, 0, 0.018)), pod + Vector((-0.012, 0, 0.024)), 0.04, M['dial'], 32)
    bar = [(1.03, -0.39, 1.10), (1.08, -0.30, 1.08), (1.12, -0.15, 1.04), (1.13, 0, 1.03), (1.12, 0.15, 1.04), (1.08, 0.30, 1.08), (1.03, 0.39, 1.10)]
    tube(bar, 0.011, M['black'])
    for s in (-1, 1):
        cyl((1.04, s * 0.30, 1.095), (1.025, s * 0.41, 1.105), 0.017, M['rubber'], 16)   # grips
        tube([(1.07, s * 0.25, 1.09), (1.08, s * 0.28, 1.16), (1.06, s * 0.31, 1.22)], 0.005, M['black'])  # mirror stalk
        cyl((1.06, s * 0.31, 1.22), (1.045, s * 0.31, 1.22), 0.042, M['black'], 32)
        box((1.3, s * 0.13, 0.86), (0.05, 0.02, 0.02), M['amber'], 0.006)  # indicators

    # frame: double cradle + spine + subframe
    for y in (-0.075, 0.075):
        tube([tuple(HEAD + Vector((0, y * 0.3, -0.05))), (1.02, y, 0.62), (0.98, y, 0.34), (0.90, y, 0.20), (0.62, y, 0.20), (0.52, y, 0.34), (0.50, y, 0.55)], 0.016, M['black'])
        tube([(0.50, y, 0.55), (0.40, y * 1.3, 0.74), (0.05, y * 1.4, 0.78), (-0.12, y * 1.2, 0.76)], 0.014, M['black'])
    tube([tuple(HEAD), (0.95, 0, 0.86), (0.60, 0, 0.80), (0.46, 0, 0.74)], 0.02, M['black'])

    # swingarm + chain guard + twin shocks
    for y in (-0.1, 0.1):
        cyl((0.50, y, 0.36), (0.0, y, 0.315), 0.02, M['black'], 16)
        top = Vector((0.12, y * 1.35, 0.77)); bot = Vector((0.04, y * 1.3, 0.37))
        cyl(bot, top, 0.012, M['chrome'], 16)
        d = (top - bot)
        for k in range(9):
            torus(bot + d * (0.18 + 0.075 * k), 0.028, 0.005, M['black'], 'Z', 24, 6).rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
        cyl(bot + d * 0.1, bot + d * 0.17, 0.03, M['black'], 16)
        cyl(top - d * 0.14, top - d * 0.02, 0.028, M['black'], 16)
    box((0.26, -0.13, 0.38), (0.42, 0.012, 0.05), M['black'], 0.01, (0, math.radians(-4), 0))

    # engine: big air/oil-cooled parallel twin that fills the space under the tank
    box((0.76, 0, 0.37), (0.40, 0.30, 0.24), M['engine'], 0.05)
    box((0.66, 0, 0.30), (0.22, 0.22, 0.16), M['engine'], 0.05)          # gearbox case
    cyl_c = Vector((0.85, 0, 0.60))
    tilt = (0, math.radians(-8), 0)
    box(cyl_c, (0.16, 0.27, 0.27), M['engine'], 0.02, tilt)
    for k in range(14):
        z = -0.12 + k * 0.0175
        off = Vector((math.sin(math.radians(8)) * z, 0, z))
        box(cyl_c + off, (0.245, 0.36, 0.0055), M['fin'] if k % 2 == 0 else M['engine'], 0.002, tilt)
    box(cyl_c + Vector((0.02, 0, 0.165)), (0.21, 0.33, 0.075), M['engine'], 0.03, tilt)   # rocker cover
    for s_ in (-1, 1):
        cyl((0.92, s_ * 0.12, 0.61), (0.92, s_ * 0.19, 0.61), 0.012, M['fin'], 12)       # spark plug caps
    cyl((0.70, 0.15, 0.38), (0.70, 0.19, 0.38), 0.115, M['engine'], 48)     # clutch cover
    cyl((0.70, 0.19, 0.38), (0.70, 0.196, 0.38), 0.08, M['fin'], 48)
    cyl((0.76, -0.15, 0.39), (0.76, -0.185, 0.39), 0.105, M['engine'], 48)  # alternator cover
    cyl((0.76, -0.185, 0.39), (0.76, -0.19, 0.39), 0.07, M['fin'], 48)

    # exhausts: headers down the front, peashooter mufflers
    for y in (-0.09, 0.09):
        s = 1 if y > 0 else -1
        tube([(0.94, y, 0.60), (1.00, y, 0.52), (1.00, y * 1.2, 0.30), (0.92, s * 0.14, 0.18), (0.62, s * 0.17, 0.18), (0.42, s * 0.19, 0.22)], 0.021, M['black'])
        cyl((0.44, s * 0.19, 0.225), (-0.18, s * 0.19, 0.35), 0.042, M['black'], 32, 0.05)
        cyl((-0.18, s * 0.19, 0.35), (-0.2, s * 0.19, 0.354), 0.05, M['fin'], 32)

    # fuel tank: deformed sphere, narrower and lower at the back
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1, location=(0, 0, 0))
    tank = active()
    sp = lambda t, e: math.copysign(abs(t) ** e, t)
    for v in tank.data.vertices:
        x, y, z = v.co
        x, y = sp(x, 0.8), sp(y, 0.75)
        z = sp(z, 0.55) if z > 0 else z
        rear = (1 - x) / 2
        y *= 1 - 0.3 * rear ** 1.4
        if z > 0: z *= 0.72
        if z < -0.3: z = -0.3 + (z + 0.3) * 0.25
        z -= 0.14 * rear ** 2
        v.co = (x, y, z)
    tank.scale = (0.30, 0.165, 0.17); tank.location = (0.855, 0, 0.935); tank.rotation_euler = (0, math.radians(-3), 0)
    finish(tank, M['paint'])
    for s in (-1, 1):
        sphere((0.67, s * 0.14, 0.92), (0.075, 0.02, 0.05), M['rubber'], 24, 12)   # knee pads
        sphere((0.92, s * 0.172, 0.95), (0.055, 0.005, 0.024), M['chrome'], 24, 10)    # badge
    cyl((0.93, 0, 1.10), (0.93, 0, 1.115), 0.035, M['chrome'], 32)                  # filler cap

    # seat: long flat bench, tail with lamp, grab rail, side panels
    box((0.30, 0, 0.835), (0.62, 0.27, 0.1), M['seat'], 0.045)
    box((0.30, 0, 0.787), (0.64, 0.25, 0.02), M['black'], 0.006)
    for k in range(6):                                                        # seat ribs
        box((0.08 + k * 0.075, 0, 0.887), (0.006, 0.24, 0.006), M['rubber'], 0.002)
    band(RA, 0.36, 0.17, 45, 172, 0.006, M['paint'])
    box((-0.10, 0, 0.66), (0.05, 0.1, 0.06), M['black'], 0.01)
    sphere((-0.13, 0, 0.66), (0.012, 0.045, 0.03), M['tail'], 20, 10)
    tube([(0.12, -0.14, 0.80), (-0.05, -0.15, 0.82), (-0.13, 0, 0.83), (-0.05, 0.15, 0.82), (0.12, 0.14, 0.80)], 0.011, M['black'])
    for s in (-1, 1):
        sidecover(s)
        cyl((0.54, s * 0.12, 0.28), (0.54, s * 0.24, 0.28), 0.014, M['rubber'], 16)   # rider pegs
    # chain + sprocket (left)
    cyl((0.0, -0.11, 0.315), (0.0, -0.1, 0.315), 0.11, M['black'], 48)
    tube([(0.0, -0.105, 0.43), (0.62, -0.105, 0.36)], 0.006, M['fin'])
    tube([(0.0, -0.105, 0.2), (0.62, -0.105, 0.28)], 0.006, M['fin'])

def build_rider():
    # hips over the seat, relaxed upright posture, hands on the grips, boots on the pegs
    hip = Vector((0.34, 0, 0.93)); chest = Vector((0.45, 0, 1.28)); neck = Vector((0.49, 0, 1.40))
    capsule(hip, chest, 0.15, M['jacket'], 0.17)
    sphere(chest + Vector((0, 0, 0.02)), (0.13, 0.2, 0.13), M['jacket'])
    capsule(chest, neck, 0.06, M['jacket'])
    head = neck + Vector((0.03, 0, 0.14))
    sphere(head, (0.14, 0.13, 0.145), M['helmet'], 40, 20)
    sphere(head + Vector((0.075, 0, 0.0)), (0.075, 0.105, 0.06), M['visor'], 32, 12)
    for s in (-1, 1):
        sh = chest + Vector((0.0, s * 0.19, 0.06))
        el = Vector((0.72, s * 0.3, 1.08))
        grip = Vector((1.03, s * 0.35, 1.10))
        capsule(sh, el, 0.055, M['jacket'], 0.048)
        capsule(el, grip, 0.045, M['jacket'], 0.04)
        sphere(grip, (0.045, 0.045, 0.045), M['glove'])
        hp = hip + Vector((0.02, s * 0.12, 0.0))
        knee = Vector((0.70, s * 0.19, 0.78))
        ankle = Vector((0.56, s * 0.2, 0.33))
        capsule(hp, knee, 0.085, M['jeans'], 0.07)
        capsule(knee, ankle, 0.065, M['jeans'], 0.05)
        box(ankle + Vector((0.05, 0, -0.04)), (0.2, 0.09, 0.09), M['boot'], 0.03)

# ---------- scene
def studio(transparent=True):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.05, 0.055, 0.065, 1); bg.inputs['Strength'].default_value = 0.12
    def area(name, loc, rot, size, energy, color=(1, 1, 1), sy=None):
        l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = color
        if sy: l.shape = 'RECTANGLE'; l.size_y = sy
        o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = rot
        return o
    area('key', (2.2, -2.6, 3.0), (math.radians(50), 0, math.radians(40)), 2.0, 700)
    area('rim', (-1.6, 2.2, 1.8), (math.radians(-60), 0, math.radians(215)), 0.6, 700, (0.85, 0.9, 1.0), 3.5)
    area('top', (0.7, 0, 3.2), (0, 0, 0), 1.2, 350, sy=3.0)
    area('fill', (0.6, -3.5, 0.6), (math.radians(90), 0, 0), 3.0, 60, (1.0, 0.95, 0.9))
    area('kick', (3.2, 1.2, 1.2), (math.radians(80), 0, math.radians(110)), 1.0, 300, (1.0, 0.85, 0.7), 2.5)
    # shadow catcher floor
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0.7, 0, 0))
    floor = active(); floor.is_shadow_catcher = True
    sc.render.film_transparent = transparent

def camera(loc, target, lens=50, ortho=None):
    sc = bpy.context.scene
    cam = bpy.data.cameras.new('cam'); cam.lens = lens
    if ortho: cam.type = 'ORTHO'; cam.ortho_scale = ortho
    o = bpy.data.objects.new('cam', cam); sc.collection.objects.link(o); o.location = loc
    d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = o
    return o

def render(path, w, h, samples=64, fmt='PNG'):
    import addon_utils
    addon_utils.enable('cycles', default_set=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples; sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'; sc.view_settings.exposure = -0.8
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.image_settings.file_format = fmt; sc.render.image_settings.color_mode = 'RGBA'
    if fmt == 'WEBP': sc.render.image_settings.quality = 84
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    view = argv[0] if argv else 'three'
    out = argv[1]
    rider = 'rider' in argv
    reset(); make_materials(); build_bike()
    if rider: build_rider()
    studio(transparent=True)
    if view == 'three':
        camera((3.2, -3.5, 1.35), (0.62, 0, 0.58), 50)
        render(out, 1000, 640, int(argv[2]) if len(argv) > 2 and argv[2].isdigit() else 48)
    elif view == 'side':
        # frame x in [-0.45, 1.75] m and z in [0, 1.8] m exactly (2.2 m x 1.8 m)
        camera((0.65, -8, 0.9), (0.65, 0, 0.9), ortho=2.2)
        w = int(argv[3]) if len(argv) > 3 else 880
        render(out, w, round(w * 1.8 / 2.2), 64, fmt=argv[4] if len(argv) > 4 else 'PNG')
    elif view == 'spin':
        # turntable: rotate the bike about its centre, camera and lights fixed
        frames = int(argv[2]); only = [int(a) for a in argv[3].split(',')] if len(argv) > 3 and argv[3] != 'all' else range(frames)
        pivot = bpy.data.objects.new('pivot', None); bpy.context.collection.objects.link(pivot); pivot.location = (0.65, 0, 0)
        for o in list(bpy.context.scene.objects):
            if o.type in ('MESH', 'CURVE') and not o.is_shadow_catcher:
                o.parent = pivot; o.matrix_parent_inverse = Matrix.Translation(-pivot.location)
        camera((0.65 + 3.4, -4.0, 1.55), (0.65, 0, 0.52), 64)
        for i in only:
            pivot.rotation_euler = (0, 0, 2 * math.pi * i / frames)
            render(f'{out}/spin-{i:02d}.webp', 800, 500, 40, fmt='WEBP')
    print('WROTE', out)
