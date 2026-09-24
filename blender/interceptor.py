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
    M['disc'] = material('disc', (0.16, 0.16, 0.17), 1.0, 0.38)
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

def fender(center, R, width, a0, a1, m, skirt=0.04):
    band(center, R, width, a0, a1, 0.006, m)
    for y in (-width / 2, width / 2 - 0.004):
        band((center[0], center[1] + y + 0.002, center[2]), R - skirt, 0.004, a0, a1, skirt, m)

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

def loft(stations, m, n=48, p=2.6, name='loft'):
    """Skin superellipse cross-sections. Each station: (x, z_bottom, z_top, half_width)."""
    bm = bmesh.new(); rings = []
    for x, zb, zt, hw in stations:
        zc, hz = (zb + zt) / 2, (zt - zb) / 2
        ring = []
        for k in range(n):
            t = 2 * math.pi * k / n; c, s_ = math.cos(t), math.sin(t)
            y = hw * math.copysign(abs(c) ** (2 / p), c); z = zc + hz * math.copysign(abs(s_) ** (2 / p), s_)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.modifiers.new('s', 'SUBSURF').levels = 2
    return finish(o, m)

def prism(pts, y0, y1, m, bevel=0.02, name='prism'):
    """Extrude a side-view outline (x, z) between y0 and y1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in pts]; b = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(a[::-1]); bm.faces.new(b)
    for i in range(len(pts)):
        j = (i + 1) % len(pts); bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    if bevel:
        mod = o.modifiers.new('b', 'BEVEL'); mod.width = bevel; mod.segments = 5; mod.limit_method = 'ANGLE'
    return finish(o, m)

# ---------- the bike (profiles traced from Wikimedia Commons side photos, 660 px/m)
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
    side = -0.085 if front else -0.075
    R = 0.16 if front else 0.135
    torus(c + Vector((0, side, 0)), R - 0.022, 0.022, M['disc'], 'Y', 64, 6).scale = (1, 1, 0.14)   # annular rotor
    for k in range(6):                                                                              # carrier arms
        a = 2 * math.pi * k / 6
        cyl(c + Vector((0.06 * math.cos(a), side, 0.06 * math.sin(a))), c + Vector(((R - 0.03) * math.cos(a), side, (R - 0.03) * math.sin(a))), 0.008, M['black'], 8)

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
    # camera side (-Y) is the bike's right side: clutch cover, rear disc
    wheel(RA, 0.315, 0.13, False)
    wheel(FA, 0.31, 0.10, True)

    # front fork at 24 deg rake, gaiters, clamps
    fork_dir = Vector((-math.sin(math.radians(24)), 0, math.cos(math.radians(24))))
    for y in (-0.095, 0.095):
        low = FA + Vector((0, y, 0)); mid = FA + fork_dir * 0.28 + Vector((0, y, 0)); top = FA + fork_dir * 0.70 + Vector((0, y, 0))
        cyl(low, mid, 0.03, M['black'], 24)
        cyl(mid, mid + fork_dir * 0.2, 0.034, M['rubber'], 24)                 # gaiter
        cyl(mid + fork_dir * 0.2, top, 0.022, M['black'], 24)
    cyl(FA + Vector((0, -0.1, 0)), FA + Vector((0, 0.1, 0)), 0.014, M['fin'], 16)
    for t in (0.58, 0.70):
        box(FA + fork_dir * t, (0.08, 0.26, 0.025), M['black'], 0.008)
    fender(FA, 0.35, 0.13, 32, 122, M['black'])                                     # short front fender
    box(FA + Vector((-0.1, -0.09, 0.1)), (0.07, 0.03, 0.05), M['black'], 0.01)

    # 7-inch headlamp on ears, chrome ring, twin clocks, braced bars, round mirrors
    hl = Vector((1.29, 0, 0.845))
    sphere(hl, (0.075, 0.088, 0.088), M['black'])
    torus(hl + Vector((0.06, 0, 0)), 0.084, 0.008, M['chrome'], 'X', 48, 10)
    lens = sphere(hl + Vector((0.062, 0, 0)), (0.01, 0.08, 0.08), M['glass'], 32, 12); lens.name = 'headlamp_lens'
    for y in (-0.1, 0.1):
        cyl(hl + Vector((-0.04, y, 0.02)), FA + fork_dir * 0.52 + Vector((0, y, 0)), 0.01, M['black'], 12)
        pod = FA + fork_dir * 0.72 + Vector((0.02, y * 0.7, 0.05))
        cyl(pod + Vector((0.025, 0, -0.03)), pod + Vector((-0.01, 0, 0.02)), 0.045, M['black'], 32)
        cyl(pod + Vector((-0.008, 0, 0.018)), pod + Vector((-0.012, 0, 0.024)), 0.039, M['dial'], 32)
        box(hl + Vector((0.02, y * 1.25, 0.03)), (0.05, 0.02, 0.02), M['amber'], 0.006)      # indicators
    top = FA + fork_dir * 0.72
    bar = [(1.02, -0.38, 1.06), (1.06, -0.30, 1.06), (1.10, -0.16, 1.03), (top.x, 0, top.z + 0.06), (1.10, 0.16, 1.03), (1.06, 0.30, 1.06), (1.02, 0.38, 1.06)]
    tube(bar, 0.011, M['black'])
    cyl((1.09, -0.14, 1.045), (1.09, 0.14, 1.045), 0.008, M['black'], 12)               # brace
    for s in (-1, 1):
        cyl((1.035, s * 0.30, 1.06), (1.015, s * 0.41, 1.065), 0.017, M['rubber'], 16)
        tube([(1.06, s * 0.26, 1.06), (1.07, s * 0.29, 1.16), (1.05, s * 0.32, 1.27)], 0.005, M['black'])
        cyl((1.055, s * 0.32, 1.28), (1.04, s * 0.32, 1.28), 0.045, M['black'], 32)

    # frame: twin cradle, triangulated rear, seat rails
    for y in (-0.075, 0.075):
        tube([(1.12, y * 0.4, 0.93), (1.06, y, 0.62), (1.02, y, 0.32), (0.96, y, 0.19), (0.62, y, 0.17), (0.50, y, 0.30), (0.47, y, 0.42)], 0.016, M['black'])
        tube([(0.47, y, 0.42), (0.40, y * 1.2, 0.62), (0.34, y * 1.4, 0.79)], 0.014, M['black'])
        tube([(0.47, y, 0.42), (0.56, y * 1.2, 0.62), (0.62, y * 1.3, 0.79)], 0.014, M['black'])
        tube([(0.70, y * 1.2, 0.80), (0.30, y * 1.45, 0.79), (-0.05, y * 1.45, 0.79), (-0.18, y * 1.1, 0.78)], 0.013, M['black'])
        tube([(0.40, y * 1.3, 0.62), (0.19, y * 1.45, 0.70), (0.00, y * 1.45, 0.76)], 0.011, M['black'])
    tube([(1.12, 0, 0.95), (0.95, 0, 0.84), (0.70, 0, 0.80)], 0.02, M['black'])

    # swingarm, chain side, twin shocks with springs
    for y in (-0.1, 0.1):
        cyl((0.47, y, 0.40), (0.0, y, 0.315), 0.02, M['black'], 16)
        bot = Vector((0.06, y * 1.35, 0.38)); tp = Vector((0.19, y * 1.35, 0.72))
        cyl(bot, tp, 0.012, M['chrome'], 16)
        d = tp - bot
        for k in range(10):
            torus(bot + d * (0.16 + 0.068 * k), 0.029, 0.0055, M['black'], 'Z', 24, 6).rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
        cyl(bot + d * 0.08, bot + d * 0.16, 0.032, M['black'], 16)
        cyl(tp - d * 0.16, tp - d * 0.02, 0.03, M['black'], 16)
    box((0.24, 0.13, 0.37), (0.44, 0.012, 0.05), M['black'], 0.01, (0, math.radians(-10), 0))

    # engine: 648 cc air/oil-cooled parallel twin
    loft([(0.54, 0.27, 0.44, 0.10), (0.58, 0.21, 0.50, 0.14), (0.70, 0.19, 0.52, 0.15), (0.86, 0.19, 0.52, 0.15), (0.94, 0.22, 0.48, 0.14), (0.975, 0.28, 0.42, 0.10)], M['engine'], p=3.0, name='crankcase')
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1, depth=0.03, location=(0.76, -0.16, 0.355))
    cc = active(); cc.scale = (0.2, 0.15, 1); cc.rotation_euler = (math.pi / 2, 0, 0); finish(cc, M['engine'])  # clutch cover (right)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1, depth=0.006, location=(0.76, -0.177, 0.355))
    cc2 = active(); cc2.scale = (0.17, 0.12, 1); cc2.rotation_euler = (math.pi / 2, 0, 0); finish(cc2, M['black'])
    sphere((0.80, -0.181, 0.36), (0.05, 0.004, 0.018), M['fin'], 20, 8)                       # cover script plate
    cyl((0.70, 0.15, 0.36), (0.70, 0.18, 0.36), 0.11, M['engine'], 48)                  # alternator (left)
    cyl_c = Vector((0.84, 0, 0.60)); tilt = (0, math.radians(-8), 0)
    box(cyl_c, (0.17, 0.28, 0.20), M['engine'], 0.02, tilt)
    for k in range(10):
        z = -0.085 + k * 0.018
        off = Vector((math.sin(math.radians(8)) * z, 0, z))
        box(cyl_c + off, (0.26, 0.37, 0.006), M['fin'] if k % 2 == 0 else M['engine'], 0.002, tilt)
    box(cyl_c + Vector((0.015, 0, 0.115)), (0.24, 0.35, 0.05), M['engine'], 0.02, tilt)   # head
    box(cyl_c + Vector((0.02, 0, 0.155)), (0.19, 0.30, 0.035), M['engine'], 0.015, tilt)  # rocker cover
    box((0.66, 0, 0.62), (0.12, 0.22, 0.12), M['black'], 0.03)                          # throttle bodies
    box((0.64, -0.12, 0.64), (0.06, 0.04, 0.06), M['fin'], 0.01)                        # breather
    box((0.75, 0, 0.17), (0.3, 0.2, 0.05), M['engine'], 0.02)                           # sump

    # exhausts: headers wrap the front of the engine, long upswept peashooters
    for s in (-1, 1):
        y1 = s * 0.075
        tube([(0.95, y1, 0.57), (1.02, y1, 0.53), (1.045, s * 0.10, 0.42), (1.03, s * 0.12, 0.28), (0.97, s * 0.13, 0.17), (0.85, s * 0.14, 0.14), (0.66, s * 0.15, 0.15), (0.46, s * 0.17, 0.215)], 0.021, M['black'])
        cyl((0.47, s * 0.17, 0.215), (0.43, s * 0.172, 0.23), 0.028, M['fin'], 24)          # clamp
        cyl((0.43, s * 0.172, 0.23), (-0.30, s * 0.19, 0.49), 0.04, M['black'], 40, 0.056)
        cyl((-0.30, s * 0.19, 0.49), (-0.36, s * 0.19, 0.51), 0.056, M['black'], 40, 0.03)  # reverse cone
        cyl((-0.36, s * 0.19, 0.51), (-0.365, s * 0.19, 0.512), 0.03, M['fin'], 24)

    # fuel tank: lofted from traced side profile (flat bottom, domed top, narrow tail)
    loft([(0.585, 0.795, 0.805, 0.055), (0.61, 0.78, 0.845, 0.105), (0.66, 0.772, 0.88, 0.138), (0.74, 0.77, 0.912, 0.165),
          (0.84, 0.772, 0.932, 0.183), (0.94, 0.778, 0.94, 0.189), (1.02, 0.79, 0.932, 0.183), (1.08, 0.805, 0.91, 0.165),
          (1.12, 0.825, 0.88, 0.121), (1.14, 0.845, 0.86, 0.044)], M['paint'], p=2.4, name='tank')
    for s in (-1, 1):
        sphere((0.76, s * 0.158, 0.858), (0.10, 0.018, 0.042), M['rubber'], 32, 12).rotation_euler = (0, math.radians(8), 0)  # knee pads
        sphere((1.0, s * 0.182, 0.86), (0.045, 0.006, 0.03), M['chrome'], 24, 10)                                       # badge
    cyl((0.95, 0, 0.935), (0.95, 0, 0.95), 0.035, M['chrome'], 32)                                                       # filler cap

    # seat: long flat bench with a small kick at the back, pleated top
    loft([(-0.13, 0.80, 0.86, 0.04), (-0.10, 0.79, 0.90, 0.11), (-0.02, 0.79, 0.90, 0.135), (0.15, 0.79, 0.885, 0.14),
          (0.35, 0.795, 0.875, 0.14), (0.52, 0.80, 0.868, 0.13), (0.60, 0.805, 0.85, 0.09), (0.63, 0.81, 0.83, 0.04)], M['seat'], p=3.2, name='seat')
    for k in range(9):
        x = -0.06 + k * 0.07
        box((x, 0, 0.885 - 0.012 * (k / 8)), (0.005, 0.25, 0.012), M['rubber'], 0.002)
    box((0.25, 0, 0.78), (0.78, 0.22, 0.02), M['black'], 0.006)                                                        # seat pan

    # side covers: inverted triangles under the seat front
    for s in (-1, 1):
        prism([(0.33, 0.785), (0.63, 0.785), (0.495, 0.56)], s * 0.10, s * 0.145, M['paint'], 0.022, 'cover')
        sphere((0.49, s * 0.148, 0.715), (0.055, 0.004, 0.016), M['chrome'], 20, 8)
        cyl((0.56, s * 0.12, 0.33), (0.56, s * 0.24, 0.33), 0.014, M['rubber'], 16)       # rider pegs
        cyl((0.28, s * 0.14, 0.42), (0.28, s * 0.22, 0.42), 0.012, M['rubber'], 16)       # pillion pegs

    # tail: short rear fender, lamp, indicators, grab rail
    fender(RA, 0.36, 0.17, 64, 150, M['black'], 0.045)
    box((-0.20, 0, 0.75), (0.1, 0.12, 0.05), M['black'], 0.015)
    sphere((-0.255, 0, 0.765), (0.012, 0.045, 0.03), M['tail'], 20, 10)
    for s in (-1, 1):
        box((-0.23, s * 0.1, 0.74), (0.045, 0.018, 0.018), M['amber'], 0.006)
    tube([(0.20, -0.15, 0.80), (0.0, -0.155, 0.81), (-0.15, -0.12, 0.82), (-0.17, 0, 0.82), (-0.15, 0.12, 0.82), (0.0, 0.155, 0.81), (0.20, 0.15, 0.80)], 0.011, M['black'])
    # chain + sprocket on the left (+Y)
    cyl((0.0, 0.11, 0.315), (0.0, 0.1, 0.315), 0.11, M['black'], 48)
    tube([(0.0, 0.105, 0.43), (0.62, 0.105, 0.36)], 0.006, M['fin'])
    tube([(0.0, 0.105, 0.2), (0.62, 0.105, 0.28)], 0.006, M['fin'])

def build_rider():
    # hips over the seat, relaxed upright posture, hands on the grips, boots on the pegs
    hip = Vector((0.36, 0, 0.97)); chest = Vector((0.46, 0, 1.31)); neck = Vector((0.50, 0, 1.43))
    capsule(hip, chest, 0.15, M['jacket'], 0.17)
    sphere(chest + Vector((0, 0, 0.02)), (0.13, 0.2, 0.13), M['jacket'])
    capsule(chest, neck, 0.06, M['jacket'])
    head = neck + Vector((0.03, 0, 0.14))
    sphere(head, (0.14, 0.13, 0.145), M['helmet'], 40, 20)
    sphere(head + Vector((0.075, 0, 0.0)), (0.075, 0.105, 0.06), M['visor'], 32, 12)
    for s in (-1, 1):
        sh = chest + Vector((0.0, s * 0.19, 0.06))
        el = Vector((0.74, s * 0.3, 1.1))
        grip = Vector((1.02, s * 0.35, 1.065))
        capsule(sh, el, 0.055, M['jacket'], 0.048)
        capsule(el, grip, 0.045, M['jacket'], 0.04)
        sphere(grip, (0.045, 0.045, 0.045), M['glove'])
        hp = hip + Vector((0.02, s * 0.12, 0.0))
        knee = Vector((0.70, s * 0.19, 0.80))
        ankle = Vector((0.57, s * 0.21, 0.36))
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
    elif view == 'overlay':
        camera((0.677, -8, 0.626), (0.677, 0, 0.626), ortho=1600 / 660)
        render(out, 1600, 1255, 16)
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
