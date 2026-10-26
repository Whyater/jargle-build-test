# Floyd (a floppy disk) and Bud (a phone), built from simple shapes in Blender.
#
# Run headless, never with the Blender window:
#   Blender -b -P art/mascots/mascots.py -- --who floyd --poses idle,talk --out art/build/sprites
#
# Units: the character stands on the ground at z = GROUND and faces the camera,
# which looks from -y toward +y. x goes to the viewer's right, z goes up.

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

POSES = ['idle', 'blink', 'talk', 'happy', 'oops', 'think', 'wave']
GROUND = -0.5


# ---------- colors and materials ----------

def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_color(text):
    text = text.lstrip('#')
    r = int(text[0:2], 16) / 255
    g = int(text[2:4], 16) / 255
    b = int(text[4:6], 16) / 255
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def make_material(name, color, rough=0.4, metal=0.0, coat=0.0, glow=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = hex_color(color)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Coat Weight'].default_value = coat
    shader.inputs['Coat Roughness'].default_value = 0.08
    if glow > 0:
        shader.inputs['Emission Color'].default_value = hex_color(color)
        shader.inputs['Emission Strength'].default_value = glow
    return mat


def make_blush_material(name, skin, pink):
    # Pink in the middle that fades into the skin color, so the cheeks look soft
    # without needing transparency.
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes['Principled BSDF']
    shader.inputs['Roughness'].default_value = 0.6

    coords = nodes.new('ShaderNodeTexCoord')
    gradient = nodes.new('ShaderNodeTexGradient')
    gradient.gradient_type = 'SPHERICAL'
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = hex_color(skin)
    ramp.color_ramp.elements[1].position = 0.55
    ramp.color_ramp.elements[1].color = hex_color(pink)
    links.new(coords.outputs['Object'], gradient.inputs['Vector'])
    links.new(gradient.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    return mat


def make_shadow_material():
    # A dark blob that fades out at the edges, drawn under the feet.
    mat = bpy.data.materials.new('shadow')
    mat.use_nodes = True
    mat.surface_render_method = 'BLENDED'
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = hex_color('#2B2340')
    shader.inputs['Roughness'].default_value = 1.0

    coords = nodes.new('ShaderNodeTexCoord')
    gradient = nodes.new('ShaderNodeTexGradient')
    gradient.gradient_type = 'SPHERICAL'
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (0.45, 0.45, 0.45, 1)
    links.new(coords.outputs['Object'], gradient.inputs['Vector'])
    links.new(gradient.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], shader.inputs['Alpha'])
    return mat


# ---------- shapes ----------

def fillet(points, radius, steps=8):
    # Round every corner of a 2D outline (a list of (x, z) points, counterclockwise).
    result = []
    count = len(points)
    for i in range(count):
        p = Vector(points[i])
        a = Vector(points[i - 1])
        b = Vector(points[(i + 1) % count])
        to_a = (a - p).normalized()
        to_b = (b - p).normalized()
        angle = to_a.angle(to_b)
        if angle > math.radians(178):
            # a straight run, nothing to round
            result.append((p.x, p.y))
            continue
        cut = radius / math.tan(angle / 2)
        # never cut more than half of either edge
        cut = min(cut, (a - p).length / 2, (b - p).length / 2)
        r = cut * math.tan(angle / 2)
        start = p + to_a * cut
        end = p + to_b * cut
        middle = (to_a + to_b).normalized()
        center = p + middle * (r / math.sin(angle / 2))
        a0 = math.atan2(start.y - center.y, start.x - center.x)
        a1 = math.atan2(end.y - center.y, end.x - center.x)
        turn = a1 - a0
        while turn > math.pi:
            turn -= 2 * math.pi
        while turn < -math.pi:
            turn += 2 * math.pi
        for s in range(steps + 1):
            t = a0 + turn * s / steps
            result.append((center.x + r * math.cos(t), center.y + r * math.sin(t)))
    return result


def rounded_rect(width, height, radius, cx=0.0, cz=0.0, steps=8):
    w = width / 2
    h = height / 2
    corners = [(cx - w, cz - h), (cx + w, cz - h), (cx + w, cz + h), (cx - w, cz + h)]
    return fillet(corners, radius, steps)


def ellipse_points(rx, rz, cx=0.0, cz=0.0, steps=48):
    points = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        points.append((cx + rx * math.cos(t), cz + rz * math.sin(t)))
    return points


def prism(name, outline, front_y, depth, mat, bevel=0.0, bevel_steps=4, parent=None):
    # A flat 2D outline pushed back into a slab. Its front face sits at front_y.
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((x, front_y + depth, z)) for (x, z) in outline]
    face = bm.faces.new(verts)
    result = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [v for v in result['geom'] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0, -depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = bevel_steps
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(60)
        mod.harden_normals = False
    smooth_by_angle(obj)
    if parent:
        obj.parent = parent
    return obj


def smooth_by_angle(obj, degrees=40):
    mod = obj.modifiers.new('smooth', 'NODES')
    # Blender ships a "Smooth by Angle" node group; fall back to plain smooth shading.
    group = bpy.data.node_groups.get('Smooth by Angle')
    if group is None:
        obj.modifiers.remove(mod)
        for poly in obj.data.polygons:
            poly.use_smooth = True
        return
    mod.node_group = group


def blob(name, center, size, mat, parent=None, segments=40):
    # A stretched sphere. size is the radius on each axis.
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=segments // 2, radius=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = center
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def tube(name, points, radius, mat, parent=None):
    # A round noodle through the given 3D points (arms, legs, eyelids, smiles).
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 6
    curve.resolution_u = 16
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for i in range(len(points)):
        bp = spline.bezier_points[i]
        bp.co = points[i]
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def arc_points(cx, cz, rx, rz, start_deg, end_deg, y, steps=6):
    points = []
    for i in range(steps + 1):
        t = math.radians(start_deg + (end_deg - start_deg) * i / steps)
        points.append((cx + rx * math.cos(t), y, cz + rz * math.sin(t)))
    return points


# ---------- the face (shared by both characters) ----------

def mouth_outline(width, depth, sag):
    # An open smile: a gently curved top edge and a deep round bottom.
    points = []
    steps = 14
    for i in range(steps + 1):
        t = math.pi + math.pi * i / steps  # bottom half of an ellipse, left to right
        points.append((width / 2 * math.cos(t), depth * math.sin(t)))
    for i in range(1, steps):
        x = width / 2 - width * i / steps
        u = 2 * x / width
        points.append((x, -sag * (1 - u * u)))
    return fillet(points, 0.025, 4)


def tongue_outline(width, depth, sag):
    # The lower part of the mouth with a rounded top, a bit smaller than the mouth.
    points = []
    steps = 12
    for i in range(steps + 1):
        t = math.pi * 1.2 + math.pi * 0.6 * i / steps
        points.append((width / 2 * 0.86 * math.cos(t), depth * 0.86 * math.sin(t) - depth * 0.08))
    right = points[-1]
    left = points[0]
    top = max(left[1], right[1])
    for i in range(1, steps):
        t = math.pi * i / steps
        points.append((right[0] - (right[0] - left[0]) * (1 - math.cos(t)) / 2,
                       top + depth * 0.16 * math.sin(t)))
    return points


def add_mouth(face, mats, cx, top_z, surface_y, width, depth, sag=0.04):
    mouth = prism('mouth', [(cx + x, top_z + z) for (x, z) in mouth_outline(width, depth, sag)],
                  surface_y - 0.012, 0.03, mats['mouth'], bevel=0.008, bevel_steps=2, parent=face)
    tongue = [(cx + x, top_z + z) for (x, z) in tongue_outline(width, depth, sag)]
    prism('tongue', tongue, surface_y - 0.016, 0.01, mats['tongue'], parent=face)
    return mouth


def add_smile_line(face, mats, cx, cz, y, width, curve, tilt=0.0):
    # A closed smile drawn as a thin noodle.
    points = []
    for i in range(7):
        u = -1 + 2 * i / 6
        x = cx + u * width / 2
        z = cz - curve * (1 - u * u) + tilt * u
        points.append((x, y, z))
    tube('smile', points, 0.022, mats['mouth'], parent=face)


def add_eye(face, mats, x, z, y, rx, rz, look=(0.0, 0.0)):
    # Big glossy eye with one large and one small highlight.
    blob('eye', (x, y, z), (rx, 0.05, rz), mats['eye'], parent=face)
    hx = x - rx * 0.3 + look[0] * rx
    hz = z + rz * 0.35 + look[1] * rz
    blob('shine_big', (hx, y - 0.045, hz), (rx * 0.36, 0.02, rx * 0.36), mats['shine'], parent=face)
    blob('shine_small', (x + rx * 0.35 + look[0] * rx * 0.5, y - 0.04, z - rz * 0.35 + look[1] * rz * 0.5),
         (rx * 0.16, 0.015, rx * 0.16), mats['shine'], parent=face)


def add_closed_eye(face, mats, x, z, y, rx, happy):
    # happy: an upside down U, like ^ ^. Otherwise a soft downward curve (a blink).
    if happy:
        points = arc_points(x, z - rx * 0.35, rx * 0.95, rx * 0.85, 180, 0, y, 8)
    else:
        points = arc_points(x, z + rx * 0.1, rx * 0.95, rx * 0.45, 190, 350, y, 8)
    tube('closed_eye', points, 0.032, mats['eye'], parent=face)


def add_brow(face, mats, x, z, y, width, lift):
    points = [(x - width / 2, y, z - lift), (x, y, z + 0.025), (x + width / 2, y, z + lift)]
    tube('brow', points, 0.022, mats['eye'], parent=face)


def add_sweat(parent, mats, x, z, y):
    # A little teardrop for the "oops" face.
    drop = blob('sweat', (x, y, z), (0.11, 0.07, 0.14), mats['sweat'], parent=parent)
    for v in drop.data.vertices:
        if v.co.z > 0:
            pinch = 1 - (v.co.z / 0.14) * 0.85
            v.co.x *= pinch
            v.co.y *= pinch
            v.co.z *= 1.35
    blob('sweat_shine', (x - 0.03, y - 0.05, z - 0.02), (0.022, 0.01, 0.03), mats['shine'], parent=parent)


def add_face(face, mats, pose, cx, eye_z, eye_gap, surface_y, eye_rx, eye_rz, mouth_top,
             mouth_w, cheek_x, cheek_z):
    eyes_y = surface_y - 0.01
    left = cx - eye_gap / 2
    right = cx + eye_gap / 2

    if pose == 'happy':
        add_closed_eye(face, mats, left, eye_z, eyes_y - 0.03, eye_rx, happy=True)
        add_closed_eye(face, mats, right, eye_z, eyes_y - 0.03, eye_rx, happy=True)
    if pose == 'blink':
        add_closed_eye(face, mats, left, eye_z, eyes_y - 0.03, eye_rx, happy=False)
        add_closed_eye(face, mats, right, eye_z, eyes_y - 0.03, eye_rx, happy=False)
    if pose in ('idle', 'talk', 'wave', 'oops'):
        add_eye(face, mats, left, eye_z, eyes_y, eye_rx, eye_rz)
        add_eye(face, mats, right, eye_z, eyes_y, eye_rx, eye_rz)
    if pose == 'think':
        # looking up and to the side, one brow raised
        add_eye(face, mats, left + 0.03, eye_z + 0.03, eyes_y, eye_rx, eye_rz * 0.92, look=(0.25, 0.3))
        add_eye(face, mats, right + 0.03, eye_z + 0.03, eyes_y, eye_rx, eye_rz * 0.92, look=(0.25, 0.3))
        add_brow(face, mats, right + 0.02, eye_z + eye_rz + 0.12, eyes_y - 0.03, eye_rx * 1.6, 0.04)
    if pose == 'oops':
        # worried brows: the inner ends go up
        add_brow(face, mats, left, eye_z + eye_rz + 0.1, eyes_y - 0.03, eye_rx * 1.5, 0.045)
        add_brow(face, mats, right, eye_z + eye_rz + 0.1, eyes_y - 0.03, eye_rx * 1.5, -0.045)

    # cheeks
    for side in (-1, 1):
        blob('cheek', (cx + side * cheek_x, surface_y + 0.012, cheek_z),
             (eye_rx * 0.95, 0.03, eye_rx * 0.55), mats['blush'], parent=face)

    # mouth
    if pose == 'idle' or pose == 'blink':
        add_mouth(face, mats, cx, mouth_top, surface_y, mouth_w, mouth_w * 0.5)
    elif pose == 'talk':
        add_mouth(face, mats, cx, mouth_top + 0.015, surface_y, mouth_w * 0.9, mouth_w * 0.88, sag=0.0)
    elif pose == 'happy' or pose == 'wave':
        add_mouth(face, mats, cx, mouth_top + 0.02, surface_y, mouth_w * 1.18, mouth_w * 0.66, sag=0.05)
    elif pose == 'oops':
        # small round "o" mouth, a cute surprise rather than a sad face
        add_mouth(face, mats, cx, mouth_top - 0.02, surface_y, mouth_w * 0.42, mouth_w * 0.36, sag=-0.06)
    elif pose == 'think':
        add_smile_line(face, mats, cx, mouth_top - 0.04, surface_y - 0.02, mouth_w * 0.6, 0.06)


# ---------- arms and legs ----------

def arm(parent, mats, name, shoulder, hand, bend, front=0.0):
    sx, sy, sz = shoulder
    hx, hy, hz = hand
    mid = ((sx + hx) / 2 + bend[0], (sy + hy) / 2 + front, (sz + hz) / 2 + bend[1])
    tube(name, [shoulder, mid, hand], 0.05, mats['limb'], parent=parent)
    blob(name + '_hand', hand, (0.125, 0.11, 0.125), mats['glove'], parent=parent)
    # a small thumb so the hand reads as a mitten
    side = 1 if hx > sx else -1
    blob(name + '_thumb', (hx - side * 0.0 + 0.0, hy - 0.06, hz + 0.1), (0.05, 0.05, 0.06), mats['glove'], parent=parent)


def legs(parent, mats, hip_x, hip_z, spread=0.0, lift=0.0):
    for side in (-1, 1):
        top = (side * hip_x, 0.0, hip_z)
        foot = (side * (hip_x + 0.03 + spread), -0.02, GROUND + 0.16 + lift)
        tube('leg', [top, ((top[0] + foot[0]) / 2, 0, (top[2] + foot[2]) / 2), foot], 0.066, mats['limb'], parent=parent)
        blob('shoe', (foot[0] + side * 0.02, -0.09, GROUND + 0.11 + lift), (0.19, 0.25, 0.12), mats['shoe'], parent=parent)


def pose_arms(parent, mats, pose, half_width, shoulder_z, face_x, chin_z, head_top, front_y):
    left_shoulder = (-half_width + 0.02, 0.0, shoulder_z)
    right_shoulder = (half_width - 0.02, 0.0, shoulder_z)

    rest_left = (-half_width - 0.3, -0.05, shoulder_z - 0.5)
    rest_right = (half_width + 0.3, -0.05, shoulder_z - 0.5)

    if pose == 'happy':
        arm(parent, mats, 'arm_l', left_shoulder, (-half_width - 0.45, -0.05, shoulder_z + 0.75), (-0.2, -0.05))
        arm(parent, mats, 'arm_r', right_shoulder, (half_width + 0.45, -0.05, shoulder_z + 0.75), (0.2, -0.05))
    elif pose == 'wave':
        arm(parent, mats, 'arm_l', left_shoulder, rest_left, (-0.08, 0.05))
        arm(parent, mats, 'arm_r', right_shoulder, (half_width + 0.5, -0.05, shoulder_z + 0.7), (0.22, -0.1))
    elif pose == 'think':
        arm(parent, mats, 'arm_l', left_shoulder, rest_left, (-0.08, 0.05))
        # hand on the chin
        arm(parent, mats, 'arm_r', right_shoulder, (face_x + 0.16, front_y - 0.12, chin_z),
            (0.25, -0.15), front=-0.2)
    elif pose == 'oops':
        arm(parent, mats, 'arm_l', left_shoulder, rest_left, (-0.08, 0.05))
        # scratching the side of the head
        arm(parent, mats, 'arm_r', right_shoulder, (half_width + 0.08, -0.05, head_top - 0.05), (0.35, -0.05))
    else:
        arm(parent, mats, 'arm_l', left_shoulder, rest_left, (-0.08, 0.05))
        arm(parent, mats, 'arm_r', right_shoulder, rest_right, (0.08, 0.05))


# ---------- the characters ----------

def common_materials(skin):
    return {
        'eye': make_material('eye', '#1E1630', rough=0.12, coat=1.0),
        'shine': make_material('shine', '#FFFFFF', rough=0.3, glow=3.0),
        'blush': make_blush_material('blush', skin, '#FF8FA0'),
        'mouth': make_material('mouth', '#4A1428', rough=0.4),
        'tongue': make_material('tongue', '#FF7088', rough=0.5),
        'limb': make_material('limb', '#3B3155', rough=0.45, coat=0.3),
        'glove': make_material('glove', '#F2EEF8', rough=0.4, coat=0.3),
        'sweat': make_material('sweat', '#8FD6FF', rough=0.1, coat=1.0),
    }


def build_floyd(pose):
    root = empty('floyd')
    body_group = empty('floyd_body', root)
    mats = common_materials('#FFF1DE')
    mats['shoe'] = make_material('shoe', '#7B5CFF', rough=0.35, coat=0.6)
    coral = make_material('coral', '#FF6B5B', rough=0.32, coat=0.7)
    metal = make_material('metal', '#D9DEE6', rough=0.25, metal=0.9)
    dark = make_material('slot', '#3B3155', rough=0.4)
    label = make_material('label', '#FFF1DE', rough=0.55)

    width = 2.0
    height = 2.06
    depth = 0.4
    front = -depth / 2
    w = width / 2
    cut = 0.26
    # the outline of a 3.5 inch disk, with its clipped top right corner
    outline = fillet([(-w, 0), (w, 0), (w, height - cut), (w - cut, height), (-w, height)], 0.2, 10)
    prism('disk', outline, front, depth, coral, bevel=0.1, bevel_steps=6, parent=body_group)

    # metal shutter across the top, wrapped over the top edge, with its window
    shutter = rounded_rect(1.02, 0.78, 0.05, cx=0.02, cz=height - 0.41)
    prism('shutter', shutter, front - 0.04, 0.05, metal, bevel=0.02, bevel_steps=3, parent=body_group)
    window = rounded_rect(0.24, 0.48, 0.05, cx=0.26, cz=height - 0.42)
    prism('window', window, front - 0.05, 0.02, dark, bevel=0.008, bevel_steps=2, parent=body_group)
    # the little notch the shutter slides in, left of it
    notch = rounded_rect(0.2, 0.16, 0.04, cx=-0.72, cz=height - 0.2)
    prism('notch', notch, front - 0.006, 0.02, dark, bevel=0.006, bevel_steps=2, parent=body_group)

    # the label is his face
    label_shape = rounded_rect(1.66, 1.16, 0.1, cx=0.0, cz=0.72)
    prism('label', label_shape, front - 0.035, 0.04, label, bevel=0.015, bevel_steps=3, parent=body_group)
    face_y = front - 0.035

    face = empty('face', body_group)
    add_face(face, mats, pose, cx=0.0, eye_z=0.86, eye_gap=0.7, surface_y=face_y,
             eye_rx=0.165, eye_rz=0.205, mouth_top=0.6, mouth_w=0.56, cheek_x=0.56, cheek_z=0.6)
    if pose == 'oops':
        add_sweat(body_group, mats, w - 0.18, height - 0.68, front - 0.08)

    pose_arms(body_group, mats, pose, w, 0.88, 0.0, 0.34, height, face_y)

    legs(root, mats, 0.45, 0.05, spread=0.05 if pose == 'happy' else 0.0)
    if pose == 'happy':
        root.location.z = 0.14  # a little jump
    return root


def build_bud(pose):
    root = empty('bud')
    body_group = empty('bud_body', root)
    mats = common_materials('#E2F8F1')
    mats['shoe'] = make_material('shoe', '#FF6B5B', rough=0.35, coat=0.6)
    mint = make_material('mint', '#2EC4A6', rough=0.32, coat=0.7)
    bezel = make_material('bezel', '#231C33', rough=0.45, coat=0.2)
    screen = make_material('screen', '#E2F8F1', rough=0.2, coat=1.0, glow=0.12)
    dark = make_material('island', '#120E1C', rough=0.15, coat=1.0)
    button = make_material('button', '#25A88E', rough=0.3, coat=0.5)

    width = 1.4
    height = 2.36
    depth = 0.3
    front = -depth / 2
    w = width / 2

    case = rounded_rect(width, height, 0.32, cx=0.0, cz=height / 2, steps=12)
    prism('case', case, front, depth, mint, bevel=0.1, bevel_steps=6, parent=body_group)

    glass = rounded_rect(width - 0.14, height - 0.14, 0.26, cx=0.0, cz=height / 2, steps=12)
    prism('bezel', glass, front - 0.02, 0.03, bezel, bevel=0.01, bevel_steps=2, parent=body_group)
    lit = rounded_rect(width - 0.24, height - 0.26, 0.2, cx=0.0, cz=height / 2, steps=12)
    prism('screen', lit, front - 0.025, 0.01, screen, parent=body_group)
    face_y = front - 0.03

    # camera pill at the top, home bar at the bottom, status bar items
    island = rounded_rect(0.36, 0.11, 0.055, cx=0.0, cz=height - 0.25)
    prism('island', island, face_y - 0.004, 0.01, dark, parent=body_group)
    home = rounded_rect(0.42, 0.04, 0.02, cx=0.0, cz=0.22)
    prism('home_bar', home, face_y - 0.004, 0.01, dark, parent=body_group)
    battery = rounded_rect(0.13, 0.065, 0.02, cx=0.43, cz=height - 0.25)
    prism('battery', battery, face_y - 0.004, 0.01, dark, parent=body_group)
    for i in range(3):
        bar = rounded_rect(0.025, 0.03 + i * 0.015, 0.008, cx=-0.48 + i * 0.04, cz=height - 0.27 + i * 0.0075)
        prism('signal', bar, face_y - 0.004, 0.01, dark, parent=body_group)

    # side buttons: volume on the left, power on the right
    for (bz, bh) in ((1.72, 0.2), (1.46, 0.2)):
        blob('volume', (-w - 0.005, 0.0, bz), (0.035, 0.06, bh / 2), button, parent=body_group)
    blob('power', (w + 0.005, 0.0, 1.62), (0.035, 0.06, 0.16), button, parent=body_group)

    face = empty('face', body_group)
    add_face(face, mats, pose, cx=0.0, eye_z=1.32, eye_gap=0.56, surface_y=face_y,
             eye_rx=0.145, eye_rz=0.185, mouth_top=1.05, mouth_w=0.48, cheek_x=0.43, cheek_z=1.07)
    if pose == 'oops':
        add_sweat(body_group, mats, w - 0.12, height - 0.5, front - 0.08)

    pose_arms(body_group, mats, pose, w, 1.0, 0.0, 0.82, height, face_y)

    legs(root, mats, 0.34, 0.05, spread=0.05 if pose == 'happy' else 0.0)
    if pose == 'happy':
        root.location.z = 0.14  # a little jump
    return root


# ---------- scene, lights, camera ----------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(size, transparent=True, samples=32):
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
        scene.eevee.taa_render_samples = samples
        scene.eevee.use_raytracing = True
    except TypeError:
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 48
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'

    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = hex_color('#F3EEF8')
    background.inputs['Strength'].default_value = 0.4


def add_light(name, location, energy, size, color='#FFFFFF', target=(0, 0, 1.0)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.size = size
    data.color = hex_color(color)[:3]
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    direction = Vector(target) - Vector(location)
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return obj


def setup_lights():
    add_light('key', (-3.2, -4.2, 4.6), 560, 4.0, '#FFF6EC')
    add_light('fill', (4.0, -3.5, 1.6), 170, 5.0, '#EEF0FF')
    add_light('rim', (2.6, 3.6, 3.4), 520, 3.0, '#FFFFFF')
    add_light('rim2', (-3.0, 3.0, 2.0), 300, 3.0, '#FFFFFF')


def setup_camera(center_z, frame_height, lens=70):
    data = bpy.data.cameras.new('camera')
    data.lens = lens
    data.sensor_fit = 'VERTICAL'
    data.sensor_height = 36
    distance = frame_height * lens / 36
    cam = bpy.data.objects.new('camera', data)
    bpy.context.collection.objects.link(cam)
    tilt = math.radians(7)
    cam.location = (0, -distance * math.cos(tilt), center_z + distance * math.sin(tilt))
    cam.rotation_euler = (math.pi / 2 - tilt, 0, 0)
    bpy.context.scene.camera = cam
    return cam


def add_ground_shadow(width):
    mesh = bpy.data.meshes.new('shadow')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('shadow', mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = (0, -0.05, GROUND + 0.002)
    obj.scale = (width, 0.5, 1)
    obj.data.materials.append(make_shadow_material())
    obj.visible_shadow = False
    return obj


def build(who, pose):
    if who == 'floyd':
        return build_floyd(pose)
    return build_bud(pose)


def render_sprite(who, pose, out_dir, size=768):
    reset_scene()
    setup_render(size)
    setup_lights()
    root = build(who, pose)
    # turn each one a little toward the other: Floyd stands on the left, Bud on the right
    turn = 14 if who == 'floyd' else -14
    tilts = {'think': 4, 'oops': -4, 'wave': -3, 'happy': 0}
    root.rotation_euler = (0, math.radians(tilts.get(pose, 0)), math.radians(turn))
    shadow_width = 1.15 if who == 'floyd' else 0.95
    if pose == 'happy':
        shadow_width *= 0.85
    add_ground_shadow(shadow_width)
    # the same camera for both, so their feet line up and sizes match
    setup_camera(0.97, 3.45)
    path = os.path.join(out_dir, who + '-' + pose + '.png')
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('wrote', path)


def load_pixels(path):
    import numpy as np
    image = bpy.data.images.load(path)
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    bpy.data.images.remove(image)
    return pixels


def save_pixels(pixels, path):
    height, width = pixels.shape[:2]
    image = bpy.data.images.new('out', width, height, alpha=True)
    image.pixels = pixels.ravel()
    image.filepath_raw = path
    image.file_format = 'PNG'
    image.save()
    bpy.data.images.remove(image)


def lay_over(art, background_hex, circle=False):
    # Put a transparent render on a flat background color. These values are the
    # stored sRGB values, not linear ones, so the color is written as is.
    import numpy as np
    text = background_hex.lstrip('#')
    color = [int(text[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    height, width = art.shape[:2]
    out = np.zeros_like(art)
    alpha = art[..., 3:4]
    for c in range(3):
        out[..., c] = art[..., c] * alpha[..., 0] + color[c] * (1 - alpha[..., 0])
    out[..., 3] = 1.0
    if circle:
        ys, xs = np.mgrid[0:height, 0:width]
        r = width / 2
        distance = np.sqrt((xs + 0.5 - r) ** 2 + (ys + 0.5 - r) ** 2)
        # one pixel of soft edge so the circle is not jagged
        out[..., 3] = np.clip(r - distance, 0, 1)
    return out


ICON_BACKGROUND = '#7B5CFF'


def render_icon_art(path, frame_height, size=1024):
    reset_scene()
    setup_render(size)
    setup_lights()
    root = build_floyd('wave')
    root.rotation_euler = (0, 0, math.radians(6))
    # the waving arm sticks out on the right, so shift him left a little to center him
    root.location.x = -0.1
    shadow = add_ground_shadow(1.15)
    shadow.location.x = -0.1
    setup_camera(0.85, frame_height, lens=85)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_icons(out_dir):
    # The app icon is Floyd waving. "full" fills the square; "safe" keeps him inside
    # the middle two thirds, for icons the system crops to a circle or squircle.
    tight = 3.55
    render_icon_art(os.path.join(out_dir, 'art-full.png'), tight)
    render_icon_art(os.path.join(out_dir, 'art-safe.png'), tight / 0.7)
    render_icon_art(os.path.join(out_dir, 'art-fg.png'), tight / 0.62)
    full = load_pixels(os.path.join(out_dir, 'art-full.png'))
    safe = load_pixels(os.path.join(out_dir, 'art-safe.png'))
    fg = load_pixels(os.path.join(out_dir, 'art-fg.png'))
    save_pixels(lay_over(full, ICON_BACKGROUND), os.path.join(out_dir, 'icon-full.png'))
    save_pixels(lay_over(safe, ICON_BACKGROUND), os.path.join(out_dir, 'icon-safe.png'))
    save_pixels(lay_over(safe, ICON_BACKGROUND, circle=True), os.path.join(out_dir, 'icon-round.png'))
    # Android draws the foreground on its own background color, so this one is
    # opaque too and the icon looks the same everywhere.
    save_pixels(lay_over(fg, ICON_BACKGROUND), os.path.join(out_dir, 'icon-fg.png'))


def add_text(body, x, z, size, mat):
    curve = bpy.data.curves.new('text', 'FONT')
    curve.body = body
    curve.size = size
    font_path = '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf'
    if os.path.exists(font_path):
        curve.font = bpy.data.fonts.load(font_path)
    obj = bpy.data.objects.new('text', curve)
    bpy.context.collection.objects.link(obj)
    obj.location = (x, -0.3, z)
    obj.rotation_euler = (math.pi / 2, 0, 0)
    obj.data.materials.append(mat)
    return obj


def flat_material(name, color):
    # Unlit color, so text comes out exactly this color.
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.remove(nodes['Principled BSDF'])
    emit = nodes.new('ShaderNodeEmission')
    emit.inputs['Color'].default_value = hex_color(color)
    mat.node_tree.links.new(emit.outputs['Emission'], nodes['Material Output'].inputs['Surface'])
    return mat


def render_share_image(out_dir):
    reset_scene()
    setup_render(1200)
    scene = bpy.context.scene
    scene.render.resolution_y = 630
    setup_lights()
    floyd = build_floyd('idle')
    floyd.location = (-3.0, 0, 0)
    floyd.rotation_euler = (0, 0, math.radians(14))
    bud = build_bud('wave')
    bud.location = (-0.4, 0, 0)
    bud.rotation_euler = (0, 0, math.radians(-14))
    for x, width in ((-3.0, 1.15), (-0.4, 0.95)):
        shadow = add_ground_shadow(width)
        shadow.location.x = x
    ink = flat_material('ink', '#2B2340')
    add_text('Jargle', 1.1, 1.25, 1.05, ink)
    add_text('A daily tech word game.', 1.15, 0.7, 0.24, ink)
    add_text('One new word a day, explained.', 1.15, 0.32, 0.24, ink)
    setup_camera(0.85, 4.9, lens=85)
    art_path = os.path.join(out_dir, 'og-art.png')
    scene.render.filepath = art_path
    bpy.ops.render.render(write_still=True)
    save_pixels(lay_over(load_pixels(art_path), '#FFF8EE'), os.path.join(out_dir, 'og.png'))


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    who_list = ['floyd', 'bud']
    poses = POSES
    out_dir = 'art/build/sprites'
    size = 768
    i = 0
    while i < len(args):
        if args[i] == '--who':
            who_list = args[i + 1].split(',')
        elif args[i] == '--poses':
            poses = args[i + 1].split(',')
        elif args[i] == '--out':
            out_dir = args[i + 1]
        elif args[i] == '--size':
            size = int(args[i + 1])
        elif args[i] == '--icons':
            # icons and the share image instead of sprites
            os.makedirs(args[i + 1], exist_ok=True)
            render_icons(args[i + 1])
            render_share_image(args[i + 1])
            return
        i += 2
    os.makedirs(out_dir, exist_ok=True)
    for who in who_list:
        for pose in poses:
            render_sprite(who, pose, out_dir, size)


if __name__ == '__main__':
    main()
