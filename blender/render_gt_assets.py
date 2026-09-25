# Render the site assets from the converted GT->Interceptor scene (ic_from_gt.blend).
#   side  <out.webp> <width>        hero sprite with rider, 2.2 m x 1.8 m ortho frame, ground at bottom edge
#   spin  <outdir>   <frames> [ids] turntable of the bike only, transparent, 800x500 webp
import bpy, sys, math
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index('--') + 1:]
mode = argv[0]; sc = bpy.context.scene
import addon_utils; addon_utils.enable('cycles', default_set=True)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.image_settings.file_format = 'WEBP'; sc.render.image_settings.color_mode = 'RGBA'; sc.render.image_settings.quality = 84
geo = sc["gt_geo"]; RX = geo["rear"][0]; CX = RX + 0.65
# shadow catcher under the bike
bpy.ops.mesh.primitive_plane_add(size=12, location=(CX, 0, 0)); floor = bpy.context.active_object; floor.is_shadow_catcher = True
rider = bpy.data.collections["IC_rider"]
bike_objs = [o for o in sc.objects if o.type in ('MESH', 'CURVE') and o.visible_get() and o is not floor and o.name not in rider.objects]
cam = bpy.data.objects["IC_cam"]; sc.camera = cam
if mode == 'side':
    out, w = argv[1], int(argv[2])
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.2
    cam.location = (CX, -8, 0.9); cam.rotation_euler = (Vector((CX, 0, 0.9)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = w, round(w * 1.8 / 2.2); sc.cycles.samples = 64
    sc.render.filepath = out; bpy.ops.render.render(write_still=True)
elif mode == 'spin':
    outdir, frames = argv[1], int(argv[2]); ids = [int(a) for a in argv[3].split(',')] if len(argv) > 3 else range(frames)
    for o in rider.objects: o.hide_render = True
    # rotate every part's world matrix about the bike's measured centre (no parenting)
    bpy.context.view_layer.update()
    lo = Vector((1e9, 1e9, 1e9)); hi = -lo
    for o in bike_objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    ctr = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0))
    base = {o.name: o.matrix_world.copy() for o in bike_objs}
    # objects parented to other bike objects would be rotated twice; unparent all first
    for o in bike_objs:
        mw = base[o.name]; o.parent = None; o.matrix_world = mw
    def spin_to(a):
        R = Matrix.Translation(ctr) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation(-ctr)
        for o in bike_objs: o.matrix_world = R @ base[o.name]
    CX = ctr.x
    cam.data.type = 'PERSP'; cam.data.lens = 64
    cam.location = (CX + 3.4, ctr.y - 4.0, 1.55); cam.rotation_euler = (Vector((CX, ctr.y, 0.52)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = 800, 500; sc.cycles.samples = 40
    for i in ids:
        spin_to(2 * math.pi * i / frames)
        sc.render.filepath = f'{outdir}/spin-{i:02d}.webp'; bpy.ops.render.render(write_still=True)
print('DONE', mode)
