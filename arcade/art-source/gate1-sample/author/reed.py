"""Reed Hale — Gate 1 pixel authorship.

Fictional heavyweight. Not a likeness. Face, kit, and identity anchors are
explicit pixel stamps. Poses are artist-authored keypoints + scanline masses,
then posterized. Construction volumes are not the finished figure: after
shading, stamps (face/hands/shoes/kit) and per-frame pixel patches define
the readable character.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import math

from pixel_engine import (
    Canvas,
    draw_bar,
    ground_shadow,
    or_mask,
    raster_capsule,
    raster_poly,
    shade_mask,
    shade_plate,
    silhouette_rim,
    text5,
)

Expr = Literal["NEUTRAL", "BRACE", "STRAIN", "EXHALE", "GRIN", "SLACK"]

# Face 16x20. 3/4, athlete's right nearer = viewer-left.
# H=HAIR0, h=HAIR1, k=HAIR2, t=SKIN1 temple, S=SKIN2, L=SKIN3, 4=SKIN4,
# 0=SKIN0, w=WRAP1 eye white, P=HAIR0 pupil, n=SKIN1 nose, M=MOUTH,
# B=HAIR1 beard, b=HAIR0 beard edge, T=CHALK teeth, F=FLUSH2, f=FLUSH1, d=FLUSH0
FACE_CMAP = {
    "H": "HAIR0",
    "h": "HAIR1",
    "k": "HAIR2",
    "t": "SKIN1",
    "S": "SKIN2",
    "L": "SKIN3",
    "4": "SKIN4",
    "0": "SKIN0",
    "w": "WRAP1",
    "P": "HAIR0",
    "n": "SKIN1",
    "M": "MOUTH",
    "B": "HAIR1",
    "b": "HAIR0",
    "T": "CHALK",
    "F": "FLUSH2",
    "f": "FLUSH1",
    "d": "FLUSH0",
    "e": "HAIR0",  # shut eye
}

# Identity anchors baked in: wedge, shaved temple band, heavy brow gap,
# beard mass + moustache join.
# Each row is 16 chars. Hair only on top; cheeks stay skin; beard is a jaw U.
#          0123456789ABCDEF
NEUTRAL = [
    "...HHHHHHHH.....",
    "..HHHHHHHHHh....",
    "..HtLLLLHHhh....",
    ".HtL4LLLLHhhh...",
    ".tLLLLLLLLShh...",
    ".tLLLLLLLLSSh...",
    ".tLLSSSSSSSSh...",
    ".tLSSSSSSSSShb..",
    ".tSSHH.HH.SSbb..",
    ".tSSwP...wPSbb..",
    ".tSS0.....0Sbb..",
    ".tSSS.nn..SSbb..",
    ".tSSSnnnn.BBbb..",
    ".tSSBB.MM.BBbb..",
    "..SBBBBBBBBBb...",
    "..bBBBBBBBBbb...",
    "...bBBBBBBBb....",
    "....bBBBBBb.....",
    ".....bBBBb......",
    "......bBb.......",
]

BRACE = [
    "...HHHHHHHH.....",
    "..HHHHHHHHHh....",
    "..HtLLLLHHhh....",
    ".HtL4LLLLHhhh...",
    ".tLLLLLLLLShh...",
    ".ttLLLLLLLSSh...",
    ".tLLSSSSSSSSh...",
    ".tLSSSSSSSSShb..",
    ".tSSHHHHHHSSbb..",
    ".tSS.e...e.Sbb..",
    ".tSS0.....0Sbb..",
    ".tSSS.nn..SSbb..",
    ".tSSSnnnn.BBbb..",
    ".tSSBBMMMMBBbb..",
    "..SBBBBBBBBBb...",
    "..bBBBBBBBBbb...",
    "...bBBBBBBBb....",
    "....bBBBBBb.....",
    ".....bBBBb......",
    "......bBb.......",
]

STRAIN = [
    "...HHHHHHHH.....",
    "..HHHHHHHHHh....",
    "..HdFFFFHHhh....",
    ".HtfF4FFFHhhh...",
    ".tfFFFFFFFFfh...",
    ".tfFFFFFFFFfh...",
    ".tfFFFfFFFFFh...",
    ".tfFFHHHHFFfhb..",
    ".tfFHHH.HHFfbb..",
    ".tfF.ee.ee.Fbb..",
    ".tfd0.....0Fbb..",
    ".tfFF.nn..FFbb..",
    ".tfFFnnnn.BBbb..",
    ".tfFBTTTTTBBbb..",
    "..fBB.MM.BBBb...",
    "..bBBBBBBBBbb...",
    "...bBBBBBBBb....",
    "....bBBBBBb.....",
    ".....bBBBb......",
    "......bBb.......",
]

EXHALE = [
    "...HHHHHHHH.....",
    "..HHHHHHHHHh....",
    "..HtLLLLHHhh....",
    ".HtL4LLLLHhhh...",
    ".tLLLLLLLLShh...",
    ".tLLLLLLLLSSh...",
    ".tLLSSSSSSSSh...",
    ".tLSSSSSSSSShb..",
    ".tSSHH.HH.SSbb..",
    ".tSSwP...wPSbb..",
    ".tSS0.....0Sbb..",
    ".tSSS.nn..SSbb..",
    ".tSSSnnnn.BBbb..",
    ".tSSBB.MM.BBbb..",
    "..SBB.MMM.BBb...",
    "..bBB.MMM.Bbb...",
    "...bBBBBBBBb....",
    "....bBBBBBb.....",
    ".....bBBBb......",
    "......bBb.......",
]

GRIN = [
    "...HHHHHHHH.....",
    "..HHHHHHHHHh....",
    "..HtLLLLHHhh....",
    ".HtL4LLLLHhhh...",
    ".tLLLLLLLLShh...",
    ".tLLLLLLLLSSh...",
    ".tLLSSSSSSSSh...",
    ".tLSSSSSSSSShb..",
    ".tSSHH.HH.SSbb..",
    ".tSS.e...e.Sbb..",
    ".tSS0.....0Sbb..",
    ".tSSS.nn..SSbb..",
    ".tSSSnnnn.BBbb..",
    ".tSSBTTTTTBbb...",
    "..SBB.MMM.BBb...",
    "..bBBBBBBBBbb...",
    "...bBBBBBBBb....",
    "....bBBBBBb.....",
    ".....bBBBb......",
    "......bBb.......",
]

SLACK = [
    "...HHHHHHHH.....",
    "..HHHHHHHHHh....",
    "..HtLLLLHHhh....",
    ".HtL4LLLLHhhh...",
    ".tLLLLLLLLShh...",
    ".tLLHHHHLLSSh...",
    ".tLLSSSSSSSSh...",
    ".tLSSSSSSSSShb..",
    ".tSS.....SSbb...",
    ".tSSwP...wPSbb..",
    ".tSS..0.0..Sbb..",
    ".tSSS.nn..SSbb..",
    ".tSSSnnnn.BBbb..",
    ".tSSBB.MM.BBbb..",
    "..SBBBBBBBBBb...",
    "..bBBBBBBBBbb...",
    "...bBBBBBBBb....",
    "....bBBBBBb.....",
    ".....bBBBb......",
    "......bBb.......",
]

def _pad(rows: list[str], width: int) -> list[str]:
    out: list[str] = []
    for row in rows:
        r = row[:width]
        if len(r) < width:
            r = r + "." * (width - len(r))
        out.append(r)
    return out


FACES: dict[Expr, list[str]] = {
    "NEUTRAL": _pad(NEUTRAL, 16),
    "BRACE": _pad(BRACE, 16),
    "STRAIN": _pad(STRAIN, 16),
    "EXHALE": _pad(EXHALE, 16),
    "GRIN": _pad(GRIN, 16),
    "SLACK": _pad(SLACK, 16),
}

# 12x12 card head — same man, fewer features (PIXEL_RULES §4)
CARD_FACE = [
    ".HHHHHHHhh..",
    "HtL4LLLHhh..",
    "tLLLLLLSSh..",
    "tLHH.HH.SSb.",
    "tSwP..wPSbb.",
    "tS.nn..nSbb.",
    "tSBB.MM.Bbb.",
    ".BBBBBBBBb..",
    ".BBBBBBBb...",
    "..BBBBBb....",
    "...BBBb.....",
    "....Bb......",
]
CARD_FACE_STRAIN = [
    ".HHHHHHHhh..",
    "HtfF4FFHhh..",
    "tfFFFFFFfh..",
    "tfHH.HH.Ffb.",
    "tf.ee.ee.db.",
    "tf.nn..nFdb.",
    "tfBTTTTBBb..",
    ".BBBBBBBBb..",
    ".BBBBBBBb...",
    "..BBBBBb....",
    "...BBBb.....",
    "....Bb......",
]

# Rear head (title) 14x12 — wedge + shaved sides, no face
HEAD_REAR = [
    "..HHHHHHHHhh..",
    ".HHHHHHHHHHhh.",
    "HtHHHHHHHHHHht",
    "HthHHHHHHHHhth",
    "hthHHHHHHHHhth",
    "hthHHHHHHHHhth",
    ".thHHHHHHHHht.",
    ".t.HHHHHHHh.t.",
    "..tHHHHHHht...",
    "...HHHHHHh....",
    "....0SS0......",
    ".....00.......",
]
CARD_FACE = _pad(CARD_FACE, 12)
CARD_FACE_STRAIN = _pad(CARD_FACE_STRAIN, 12)
HEAD_REAR = _pad(HEAD_REAR, 14)

HEAD_REAR_CMAP = {
    "H": "HAIR0",
    "h": "HAIR1",
    "t": "SKIN1",
    "0": "SKIN0",
    "S": "SKIN2",
}

# Hands
HAND_OVER = [  # knuckles toward camera, overhand
    ".00.",
    "0SS0",
    "0LSC",
    ".0C.",
]
HAND_PALM = [  # mixed-grip palm-forward
    ".CC.",
    "CLLC",
    "0SS0",
    ".00.",
]
HAND_CMAP = {"0": "SKIN0", "S": "SKIN2", "L": "SKIN3", "C": "CHALK"}

WRAP3 = ["www", "wWw", "www"]
WRAP_CMAP = {"w": "WRAP0", "W": "WRAP1"}

SHOE = [
    "sSSSSSSSSSSSs.",
    "sSSSSSSSSSSSs.",
    "00000000000000",
    "..............",
]
SHOE_CMAP = {"s": "SHOE1", "S": "SHOE0", "0": "WRAP0"}


@dataclass
class Pose:
    name: str
    lift: str
    effort: str
    frame: int
    expr: Expr
    head: tuple[int, int]
    sh: tuple[int, int]  # shoulder center
    hip: tuple[int, int]
    bar_y: int
    bar_x0: int
    bar_x1: int
    bow: int
    knee_n: tuple[int, int]
    knee_f: tuple[int, int]
    foot_n: tuple[int, int]
    foot_f: tuple[int, int]
    elbow_n: tuple[int, int]
    elbow_f: tuple[int, int]
    hand_n: tuple[int, int]
    hand_f: tuple[int, int]
    lean: int
    plates: str  # "light" or "max"
    mixed_grip: bool = False
    chalk_puff: bool = False
    no_bar: bool = False
    shadow_w: int = 28
    rear: bool = False
    hide_head: bool = False


SKIN_RAMP = ("SKIN3", "SKIN2", "SKIN1", "SKIN0")
SING_RAMP = ("SING2", "SING1", "SING0", "SING0")
KNEE_RAMP = ("KNEE2", "KNEE1", "KNEE0", "KNEE0")


def face_stamp(c: Canvas, xy: tuple[int, int], expr: Expr) -> None:
    c.stamp(xy[0], xy[1], FACES[expr], FACE_CMAP, skip=".")


def shoe_stamp(c: Canvas, foot: tuple[int, int], flip: bool = False) -> None:
    rows = SHOE
    ox = foot[0] - 7
    oy = foot[1] - 3
    if flip:
        rows = [r[::-1] for r in rows]
    c.stamp(ox, oy, rows, SHOE_CMAP, skip=".")


def hand_stamp(c: Canvas, xy: tuple[int, int], palm: bool) -> None:
    rows = HAND_PALM if palm else HAND_OVER
    c.stamp(xy[0] - 1, xy[1] - 1, rows, HAND_CMAP, skip=".")
    c.stamp(xy[0] - 1, xy[1] + 2, WRAP3, WRAP_CMAP, skip=".")


def chevron(c: Canvas, cx: int, cy: int) -> None:
    # 5w x 3h AMB1, AMB2 top, AMB0 bottom
    c.put(cx, cy, "AMB2")
    for x in range(cx - 1, cx + 2):
        c.put(x, cy + 1, "AMB1")
    for x in range(cx - 2, cx + 3):
        c.put(x, cy + 2, "AMB1")
    c.put(cx - 2, cy + 2, "AMB0")
    c.put(cx + 2, cy + 2, "AMB0")


def belt(c: Canvas, cx: int, y0: int, half: int = 18) -> None:
    for y in range(y0, y0 + 4):
        c.span(y, cx - half, cx + half, "BELT")
    # buckle 3x3
    for y in range(y0, y0 + 3):
        for x in range(cx - 1, cx + 2):
            c.put(x, y, "AMB1")
    c.put(cx, y0, "AMB2")
    c.put(cx + 2, y0 + 1, "AMB0")  # lever line


def plate_load(c: Canvas, near_c: tuple[int, int], far_c: tuple[int, int], kind: str) -> None:
    if kind == "max":
        near = [(18, ("RED0", "RED1", "RED2")), (17, ("RED0", "RED1", "RED2")),
                (16, ("RED0", "RED1", "RED2")), (15, ("RED0", "RED1", "RED2"))]
        far = [(15, ("RED0", "RED1", "RED2")), (14, ("RED0", "RED1", "RED2")),
               (13, ("RED0", "RED1", "RED2")), (12, ("RED0", "RED1", "RED2"))]
        n_thick, f_thick = 4, 3
    else:
        near = [(18, ("RED0", "RED1", "RED2")), (15, ("BLU0", "BLU1", "BLU2"))]
        far = [(15, ("RED0", "RED1", "RED2")), (13, ("BLU0", "BLU1", "BLU2"))]
        n_thick, f_thick = 4, 3
    # far stack first (back)
    for i, (r, ramp) in enumerate(reversed(far)):
        ox = far_c[0] + i * f_thick
        shade_plate(c, ox, far_c[1], r, ramp)
    for i, (r, ramp) in enumerate(reversed(near)):
        ox = near_c[0] - i * n_thick
        shade_plate(c, ox, near_c[1], r, ramp)


def oriented_box(
    w: int, h: int, top: tuple[int, int], bot: tuple[int, int], top_w: float, bot_w: float
) -> list[list[bool]]:
    tx, ty = top
    bx, by = bot
    dx, dy = tx - bx, ty - by
    ln = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / ln, dx / ln
    pts = [
        (tx + nx * top_w / 2, ty + ny * top_w / 2),
        (tx - nx * top_w / 2, ty - ny * top_w / 2),
        (bx - nx * bot_w / 2, by - ny * bot_w / 2),
        (bx + nx * bot_w / 2, by + ny * bot_w / 2),
    ]
    return raster_poly(w, h, pts)


def torso_mask(w: int, h: int, sh: tuple[int, int], hip: tuple[int, int], sh_w: int, hip_w: int) -> list[list[bool]]:
    # Singlet is a chest box (~40), not a 52-wide kite. Delts live on the arm layer.
    return oriented_box(w, h, (sh[0], sh[1] + 4), (hip[0], hip[1] + 2), min(sh_w, 40), min(hip_w, 36))


def traps_mask(w: int, h: int, sh: tuple[int, int], sh_w: int, bar_y: int) -> list[list[bool]]:
    sx, sy = sh
    width = min(28, sh_w * 0.55)
    pts = [
        (sx - width, bar_y),
        (sx + width * 0.85, bar_y - 1),
        (sx + width * 0.7, sy + 10),
        (sx - width * 0.9, sy + 11),
    ]
    return raster_poly(w, h, pts)


def knee_band(w: int, h: int, knee: tuple[int, int]) -> list[list[bool]]:
    """Short sleeve band on the knee, not a detached sausage."""
    return raster_capsule(w, h, knee[0], knee[1] - 3, knee[0], knee[1] + 5, 5.4, 5.2)


def draw_lifter(pose: Pose, size: int = 160) -> tuple[Canvas, list[tuple[str, Canvas]]]:
    c = Canvas(size, size)
    layers: list[tuple[str, Canvas]] = []

    def layer(name: str) -> Canvas:
        ly = Canvas(size, size)
        layers.append((name, ly))
        return ly

    shad = layer("shadow")
    ground_shadow(shad, pose.hip[0], 154, pose.shadow_w, 5 if pose.effort == "light" else 6)

    far_plates = layer("far-plates")
    far_body = layer("far-body")
    kit = layer("kit")
    bar_l = layer("bar")
    near_body = layer("near-body")
    near_plates = layer("near-plates")
    face_l = layer("face")
    extras = layer("extras")

    if not pose.no_bar:
        if pose.plates == "max":
            for i, r in enumerate((15, 14, 13, 12)):
                shade_plate(far_plates, pose.bar_x1 - 4 + i * 3, pose.bar_y, r, ("RED0", "RED1", "RED2"))
            for i, r in enumerate((18, 17, 16, 15)):
                shade_plate(near_plates, pose.bar_x0 + 4 - i * 4, pose.bar_y, r, ("RED0", "RED1", "RED2"))
        else:
            # red outer, blue inner so both colours read
            shade_plate(far_plates, pose.bar_x1 - 4, pose.bar_y, 15, ("RED0", "RED1", "RED2"))
            shade_plate(far_plates, pose.bar_x1 - 14, pose.bar_y, 12, ("BLU0", "BLU1", "BLU2"))
            shade_plate(near_plates, pose.bar_x0 + 4, pose.bar_y, 18, ("RED0", "RED1", "RED2"))
            shade_plate(near_plates, pose.bar_x0 + 14, pose.bar_y, 14, ("BLU0", "BLU1", "BLU2"))

    arm_r0 = 2.8 if pose.lift == "deadlift" else 5.4
    arm_r1 = 2.2 if pose.lift == "deadlift" else 4.4
    # FAR limbs (behind singlet)
    shade_mask(
        far_body,
        or_mask(
            raster_capsule(size, size, pose.sh[0] + 12, pose.sh[1] + 2, pose.elbow_f[0], pose.elbow_f[1], arm_r0, arm_r1),
            raster_capsule(size, size, pose.elbow_f[0], pose.elbow_f[1], pose.hand_f[0], pose.hand_f[1], arm_r1, 2.8),
        ),
        SKIN_RAMP,
    )
    shade_mask(
        far_body,
        raster_capsule(size, size, pose.hip[0] + 8, pose.hip[1], pose.knee_f[0], pose.knee_f[1], 8.4, 6.4),
        SKIN_RAMP,
    )
    shade_mask(
        far_body,
        raster_capsule(size, size, pose.knee_f[0], pose.knee_f[1], pose.foot_f[0], pose.foot_f[1] - 3, 5.4, 4.4),
        SKIN_RAMP,
    )
    shade_mask(far_body, knee_band(size, size, pose.knee_f), KNEE_RAMP)
    shoe_stamp(far_body, pose.foot_f, flip=True)

    # singlet + traps (chest box)
    sh_w = 40 if pose.effort == "light" else 42
    hip_w = 36
    tmask = torso_mask(size, size, pose.sh, pose.hip, sh_w, hip_w)
    # Squat bar sits on the traps. Deadlift bar is in the hands — never stretch
    # traps down to the sleeve or the setup reads as a standing hitch.
    if pose.lift == "deadlift" or pose.no_bar:
        trap_y = pose.sh[1] - 3
    else:
        trap_y = pose.bar_y
    trmask = traps_mask(size, size, pose.sh, sh_w, trap_y)
    shade_mask(kit, or_mask(tmask, trmask), SING_RAMP, rim_lit="SING3")
    # neck
    nx, ny = pose.head[0] + 7, pose.head[1] + 18
    shade_mask(
        kit,
        raster_capsule(size, size, nx, ny, pose.sh[0], pose.sh[1] + 2, 5.0, 6.0),
        SKIN_RAMP,
    )
    chevron(kit, pose.sh[0], pose.sh[1] + 12)
    belt(kit, pose.hip[0], pose.hip[1] - 5, half=16)

    # NEAR limbs (in front of singlet)
    shade_mask(
        near_body,
        raster_capsule(size, size, pose.hip[0] - 8, pose.hip[1] + 1, pose.knee_n[0], pose.knee_n[1], 8.8, 6.6),
        SKIN_RAMP,
    )
    shade_mask(
        near_body,
        raster_capsule(size, size, pose.knee_n[0], pose.knee_n[1], pose.foot_n[0], pose.foot_n[1] - 3, 5.6, 4.5),
        SKIN_RAMP,
    )
    shade_mask(near_body, knee_band(size, size, pose.knee_n), KNEE_RAMP)
    shade_mask(
        near_body,
        or_mask(
            raster_capsule(size, size, pose.sh[0] - 12, pose.sh[1] + 3, pose.elbow_n[0], pose.elbow_n[1], arm_r0, arm_r1),
            raster_capsule(size, size, pose.elbow_n[0], pose.elbow_n[1], pose.hand_n[0], pose.hand_n[1], arm_r1, 2.8),
        ),
        SKIN_RAMP,
    )
    if pose.lift != "deadlift":
        shade_mask(
            near_body,
            raster_capsule(size, size, pose.sh[0] - 14, pose.sh[1] + 2, pose.sh[0] - 8, pose.sh[1] + 7, 5.2, 4.4),
            SKIN_RAMP,
        )
    shoe_stamp(near_body, pose.foot_n)

    if not pose.no_bar:
        draw_bar(bar_l, pose.bar_x0, pose.bar_x1, pose.bar_y, bow=pose.bow)
        if pose.lift != "deadlift":
            kit.put(pose.sh[0] - 6, pose.bar_y + 2, "SKIN0")
            kit.put(pose.sh[0] - 5, pose.bar_y + 2, "SKIN0")

    if pose.rear:
        face_l.stamp(pose.head[0], pose.head[1], HEAD_REAR, HEAD_REAR_CMAP, skip=".")
    elif not pose.hide_head:
        face_stamp(face_l, pose.head, pose.expr)

    palm_n = pose.mixed_grip
    hand_stamp(extras, pose.hand_n, palm_n)
    hand_stamp(extras, pose.hand_f, False)

    if pose.chalk_puff:
        for dx, dy in ((0, 0), (1, -1), (-1, 0), (2, 0), (0, 1), (3, -1), (-2, 1)):
            extras.put(pose.hand_n[0] + dx, pose.hand_n[1] + dy - 2, "CHALK")
            extras.put(pose.sh[0] + dx - 4, pose.bar_y + dy + 3, "CHALK")

    if pose.effort == "max" and pose.expr == "STRAIN":
        extras.put(pose.head[0] + 4, pose.head[1] + 6, "WRAP1")
        extras.put(pose.head[0] + 3, pose.head[1] + 7, "WRAP1")

    for ly in layers:
        c.blit(ly[1])
    silhouette_rim(c)
    # Spec: no opaque pixels below master row 318. Native y=159 → 318/319 at 2×.
    # Canvas.put ignores None, so write the buffer directly.
    if size == 160:
        for x in range(size):
            c.p[159][x] = None
    return c, layers


def squat_pose(frame: int, max_eff: bool) -> Pose:
    light = {
        1: (50, 98, 0, 122),
        2: (70, 114, 20, 122),
        3: (96, 128, 35, 122),
        4: (80, 116, 30, 121),
        5: (54, 100, 8, 122),
        6: (50, 98, 0, 122),
    }
    heavy = {
        1: (50, 98, 5, 122),
        2: (72, 116, 25, 123),
        3: (96, 128, 40, 123),
        4: (90, 124, 38, 122),
        5: (64, 108, 22, 122),
        6: (50, 98, 4, 122),
    }
    bar_y, hips_y, lean, knee_y = (heavy if max_eff else light)[frame]
    cx = 80
    stance = 24 if max_eff else 21
    rad = math.radians(lean)
    sh_y = bar_y + 3
    sh_x = cx + int(round(10 * math.sin(rad)))
    head_y = sh_y - 20
    if max_eff:
        head_y = sh_y - 17
    head_x = sh_x - 8
    hip = (cx, hips_y)
    sh = (sh_x, sh_y)
    kn = (cx - stance - 4, knee_y)
    kf = (cx + stance - 2, knee_y - 1)
    fn = (cx - stance + 4, 152)
    ff = (cx + stance - 4, 152)
    # elbows down and back, hands on bar just outside shoulders
    en = (sh[0] - 22, bar_y + 14)
    ef = (sh[0] + 18, bar_y + 12)
    hn = (sh[0] - 18, bar_y)
    hf = (sh[0] + 16, bar_y)
    if max_eff:
        expr: Expr = "BRACE" if frame < 3 else "STRAIN"
    else:
        expr = "BRACE" if frame < 5 else "EXHALE"
    return Pose(
        name=f"squat-{'max' if max_eff else 'light'}-{frame}",
        lift="squat",
        effort="max" if max_eff else "light",
        frame=frame,
        expr=expr,
        head=(head_x, head_y),
        sh=sh,
        hip=hip,
        bar_y=bar_y,
        bar_x0=12,
        bar_x1=148,
        bow=0 if not max_eff else (1 if frame in (1, 6) else (3 if frame in (3, 4) else 2)),
        knee_n=kn,
        knee_f=kf,
        foot_n=fn,
        foot_f=ff,
        elbow_n=en,
        elbow_f=ef,
        hand_n=hn,
        hand_f=hf,
        lean=lean,
        plates="max" if max_eff else "light",
        chalk_puff=max_eff and frame == 4,
        shadow_w=30 if max_eff else 26,
    )


def deadlift_pose(frame: int, max_eff: bool) -> Pose:
    """Setup is a floor pull (plates sit on y≈154). Lockout is standing, no hitch.

    Keypoints are 3/4-view, more hinged than a 55° torso so the silhouette
    reads as bent-over vs locked — direction from the Fable brief, not a trace.
    """
    # bar_y, hip, sh, head, near-knee, far-knee
    table = {
        1: (136, (94, 100), (70, 72), (58, 50), (62, 128), (90, 126)),
        2: (128, (90, 98), (72, 66), (60, 44), (62, 126), (92, 124)),
        3: (118, (86, 96), (76, 58), (64, 36), (60, 124), (96, 122)),
        4: (110, (82, 96), (78, 52), (68, 30), (60, 122), (98, 120)),
        5: (102, (80, 94), (80, 48), (70, 26), (64, 126), (96, 124)),
        6: (98, (80, 92), (80, 46), (72, 24), (66, 128), (94, 126)),
    }
    bar_y, hip, sh, head, kn, kf = table[frame]
    if max_eff:
        bar_y += 0 if frame == 6 else 1
        hip = (hip[0], hip[1] + (1 if frame <= 2 else 0))
    cx = 80
    fn = (cx - 16, 152)
    ff = (cx + 14, 152)
    hn = (72, bar_y)
    hf = (88, bar_y)
    # Straight arms: elbows sit on the shoulder–hand line, not a chicken-wing.
    en = ((sh[0] + hn[0]) // 2 - 2, (sh[1] + bar_y) // 2)
    ef = ((sh[0] + hf[0]) // 2 + 2, (sh[1] + bar_y) // 2)
    lean = 45 if frame == 1 else (32 if frame == 2 else (18 if frame == 3 else (8 if frame < 6 else 0)))
    if max_eff:
        expr: Expr = "STRAIN" if frame >= 3 else "BRACE"
    else:
        expr = "EXHALE" if frame == 6 else "BRACE"
    return Pose(
        name=f"deadlift-{'max' if max_eff else 'light'}-{frame}",
        lift="deadlift",
        effort="max" if max_eff else "light",
        frame=frame,
        expr=expr,
        head=head,
        sh=sh,
        hip=hip,
        bar_y=bar_y,
        bar_x0=12,
        bar_x1=148,
        bow=0 if not max_eff else (2 if frame <= 3 else (1 if frame < 6 else 0)),
        knee_n=kn,
        knee_f=kf,
        foot_n=fn,
        foot_f=ff,
        elbow_n=en,
        elbow_f=ef,
        hand_n=hn,
        hand_f=hf,
        lean=lean,
        plates="max" if max_eff else "light",
        mixed_grip=max_eff,
        chalk_puff=max_eff and frame == 1,
        shadow_w=32 if max_eff else 26,
    )


def idle_pose(frame: int) -> Pose:
    # breathing: shoulders +1 on frame 2
    sh_y = 50 + (1 if frame == 2 else 0)
    chest = 1 if frame == 2 else 0
    head_y = 26
    cx = 80
    hands_y = 96 if frame != 3 else 92  # chalk rub
    hx = 56 if frame != 3 else 74
    hxf = 104 if frame != 3 else 86
    expr: Expr = "NEUTRAL"
    if frame == 4:
        expr = "BRACE"
    return Pose(
        name=f"idle-{frame}",
        lift="idle",
        effort="light",
        frame=frame,
        expr=expr,
        head=(72, head_y),
        sh=(cx, sh_y + chest),
        hip=(cx, 98),
        bar_y=50,
        bar_x0=14,
        bar_x1=146,
        bow=0,
        knee_n=(cx - 20, 122),
        knee_f=(cx + 18, 121),
        foot_n=(cx - 18, 152),
        foot_f=(cx + 16, 152),
        elbow_n=(cx - 24, 78),
        elbow_f=(cx + 22, 76),
        hand_n=(hx, hands_y),
        hand_f=(hxf, hands_y),
        lean=0,
        plates="light",
        no_bar=True,
        shadow_w=24,
    )


def squat_outcome(kind: str, frame: int, max_eff: bool) -> Pose:
    if kind == "success":
        p = squat_pose(6, max_eff)
        p.expr = "GRIN" if frame >= 3 else "EXHALE"
        if frame >= 3:
            p.no_bar = True
            p.hand_n = (58, 70)
            p.hand_f = (102, 68)
            p.elbow_n = (56, 58)
            p.elbow_f = (104, 56)
        p.name = f"success-squat-{frame}"
        return p
    # miss
    if frame == 1:
        p = squat_pose(3, max_eff)
        p.expr = "STRAIN" if max_eff else "BRACE"
        p.bar_y = p.bar_y - 2
        p.name = f"miss-squat-{frame}"
        return p
    p = squat_pose(6, max_eff)
    p.no_bar = True
    p.expr = "SLACK"
    p.hand_n = (62, 100)
    p.hand_f = (98, 100)
    p.elbow_n = (58, 84)
    p.elbow_f = (102, 82)
    if frame == 2:
        p.head = (p.head[0], p.head[1] + 2)
    if frame >= 3:
        p.head = (p.head[0], p.head[1] + 3)
    p.name = f"miss-squat-{frame}"
    return p


def draw_squat_card(max_eff: bool) -> Canvas:
    """52-lattice waist-up composition. Not a stage crop."""
    c = Canvas(52, 52)
    # plates cropped by edges
    if max_eff:
        shade_plate(c, 2, 16, 11, ("RED0", "RED1", "RED2"), hub=True)
        shade_plate(c, 50, 16, 10, ("RED0", "RED1", "RED2"), hub=True)
        bow = 1
    else:
        shade_plate(c, 2, 16, 11, ("RED0", "RED1", "RED2"), hub=True)
        shade_plate(c, 6, 16, 9, ("BLU0", "BLU1", "BLU2"), hub=True)
        shade_plate(c, 50, 16, 10, ("RED0", "RED1", "RED2"), hub=True)
        shade_plate(c, 46, 16, 8, ("BLU0", "BLU1", "BLU2"), hub=True)
        bow = 0
    # shoulders / singlet mass
    tmask = raster_poly(
        52,
        52,
        [(10, 18), (42, 16), (40, 44), (12, 46)],
    )
    shade_mask(c, tmask, SING_RAMP, rim_lit="SING3")
    # traps under bar
    tr = raster_poly(52, 52, [(14, 14), (38, 13), (36, 22), (16, 23)])
    shade_mask(c, tr, SING_RAMP, rim_lit="SING3")
    # near delt
    arm = raster_capsule(52, 52, 14, 22, 8, 28, 5.5, 4.2)
    shade_mask(c, arm, SKIN_RAMP)
    far_arm = raster_capsule(52, 52, 38, 20, 44, 26, 5.0, 4.0)
    shade_mask(c, far_arm, SKIN_RAMP)
    draw_bar(c, 0, 51, 16 + bow, bow=bow, sleeve=2)
    # head
    face_rows = CARD_FACE_STRAIN if max_eff else CARD_FACE
    c.stamp(20, 2, face_rows, FACE_CMAP, skip=".")
    chevron(c, 26, 30)
    belt(c, 26, 44, half=16)
    # wraps
    c.stamp(7, 26, WRAP3, WRAP_CMAP, skip=".")
    c.stamp(42, 24, WRAP3, WRAP_CMAP, skip=".")
    # chalk
    c.put(8, 25, "CHALK")
    c.put(43, 23, "CHALK")
    if max_eff:
        c.put(22, 8, "WRAP1")  # sweat
    allowed = {
        "OUT",
        "SKIN3",
        "SKIN1",
        "HAIR0",
        "HAIR1",
        "SING1",
        "SING0",
        "AMB1",
        "BELT",
        "RED1",
        "RED0",
        "BAR1",
        "BAR2",
        "WRAP1",
        "CHALK",
        "BLU1" if not max_eff else "FLUSH2",
    }
    from pixel_engine import PAL as _PAL

    allowed_rgb = {n: _PAL[n] for n in allowed}
    for y in range(c.h):
        for x in range(c.w):
            n = c.p[y][x]
            if n is None or n in allowed:
                continue
            rgb = _PAL[n]
            best = min(allowed, key=lambda a: sum((rgb[i] - allowed_rgb[a][i]) ** 2 for i in range(3)))
            c.put(x, y, best)
    return c


def _brick_wall(c: Canvas, x0: int, y0: int, x1: int, y1: int) -> None:
    """Irregular courses: mixed widths, mortar breaks, two face tones."""
    y = y0
    row = 0
    while y < y1:
        bh = 8 + ((row * 3) % 3)
        ox = (row % 2) * 6
        x = x0 - ox
        col = 0
        while x < x1:
            bw = 12 + ((col * 5 + row * 2) % 7)
            mortar_y = y
            for yy in range(y, min(y1, y + bh)):
                for xx in range(max(x0, x), min(x1, x + bw)):
                    is_mortar = yy == mortar_y or xx == max(x0, x)
                    if is_mortar and ((xx * 9 + yy * 5 + row) % 13 == 0):
                        is_mortar = False
                    if is_mortar:
                        c.put(xx, yy, "BRICK0")
                    else:
                        c.put(xx, yy, "BRICK1" if (row + col) % 2 == 0 else "BRICK2")
            x += bw
            col += 1
        y += bh
        row += 1


def draw_title_portrait() -> Canvas:
    """504x896 native (2x -> 1008x1792). Hero in upper 55% / safe zone."""
    w, h = 504, 896
    c = Canvas(w, h)
    # floor
    for y in range(int(h * 0.58), h):
        for x in range(w):
            c.put(x, y, "FLOOR0" if ((x // 8) + (y // 8)) % 2 == 0 else "FLOOR1")
    _brick_wall(c, 0, 0, w, int(h * 0.62))
    # darker band behind lights
    for y in range(90, 210):
        for x in range(160, 344):
            if c.get(x, y) in ("BRICK1", "BRICK2"):
                c.put(x, y, "BRICK0")
    # crowd edges
    for i, x0 in enumerate((8, 20, 36, w - 40, w - 24, w - 12)):
        top = 420 + (i % 3) * 8
        for y in range(top, top + 70):
            ww = 10 if y < top + 16 else 16
            c.span(y, x0, x0 + ww, "CROWD0" if i % 2 == 0 else "CROWD1")
    # platform
    y0, y1 = 500, 620
    for y in range(y0, y1):
        for x in range(70, 434):
            plank = (y - y0) // 8
            c.put(x, y, ("WOOD0", "WOOD1", "WOOD2")[plank % 3])
    for x in range(70, 434):
        c.put(x, y0, "AMB2")
        c.put(x, y1 - 1, "WOOD0")
    # three white lights on steel box
    bx, by = 212, 118
    for y in range(by, by + 36):
        c.span(y, bx, bx + 80, "STEEL0" if y % 2 == 0 else "STEEL1")
    for i, lx in enumerate((bx + 12, bx + 40, bx + 68)):
        for dy in range(-7, 8):
            for dx in range(-7, 8):
                if dx * dx + dy * dy <= 49:
                    c.put(lx + dx, by + 18 + dy, "LAMP" if dx * dx + dy * dy <= 16 else "WHT1")
                elif dx * dx + dy * dy <= 64:
                    c.put(lx + dx, by + 18 + dy, "BAR0")
    # lamps upper L/R
    c.put(48, 40, "LAMP")
    c.put(49, 41, "AMB3")
    c.put(w - 48, 44, "LAMP")
    c.put(w - 47, 45, "AMB2")
    # logo — safe zone x 50..453, y 94..766 at this lattice (half of 100..907 / 188..1532)
    from pixel_engine import text5_scaled

    text5_scaled(c, 86, 168, "THREE WHITE LIGHTS", "WHT1", 3, shadow="BAR0")
    text5_scaled(c, 150, 196, "IRON & AMBER ARCADE", "AMB1", 2, shadow="AMB0")
    # Reed from behind, walking onto platform
    reed = draw_reed_rear()
    c.blit(reed, 180, 250)
    return c


def draw_reed_rear() -> Canvas:
    """Back 3/4 walking pose ~140x200, identity via wedge + kit + chalk hands."""
    c = Canvas(160, 220)
    sh = (80, 48)
    hip = (80, 100)
    tmask = torso_mask(160, 220, sh, hip, 54, 38)
    shade_mask(c, tmask, SING_RAMP, rim_lit="SING3")
    # straps
    for y in range(40, 70):
        c.put(64, y, "SING2")
        c.put(65, y, "SING3")
        c.put(96, y, "SING2")
        c.put(95, y, "SING0")
    # chalk handprints on back
    for x, y in ((70, 62), (71, 63), (72, 62), (88, 64), (89, 65), (90, 64)):
        c.put(x, y, "CHALK")
    belt(c, 80, 96, half=20)
    # rear hair wedge — large enough to read on title brick
    hair = raster_poly(
        160,
        220,
        [(68, 10), (92, 10), (100, 20), (96, 34), (64, 34), (60, 20)],
    )
    shade_mask(c, hair, ("HAIR2", "HAIR1", "HAIR0", "HAIR0"))
    shade_mask(c, raster_capsule(160, 220, 80, 32, 80, 46, 5.0, 5.5), SKIN_RAMP)
    # ears
    c.put(62, 24, "SKIN2")
    c.put(63, 25, "SKIN1")
    c.put(97, 24, "SKIN2")
    c.put(96, 25, "SKIN1")
    # arms
    shade_mask(c, raster_capsule(160, 220, 54, 52, 48, 110, 6.0, 4.5), SKIN_RAMP)
    shade_mask(c, raster_capsule(160, 220, 106, 50, 114, 108, 6.0, 4.5), SKIN_RAMP)
    c.stamp(46, 108, HAND_OVER, HAND_CMAP, skip=".")
    c.stamp(112, 106, HAND_OVER, HAND_CMAP, skip=".")
    # walking legs
    shade_mask(c, raster_capsule(160, 220, 70, 104, 58, 160, 9.0, 6.5), SKIN_RAMP)
    shade_mask(c, raster_capsule(160, 220, 90, 104, 104, 148, 9.0, 6.5), SKIN_RAMP)
    shade_mask(c, raster_capsule(160, 220, 58, 160, 54, 200, 6.0, 5.0), SKIN_RAMP)
    shade_mask(c, raster_capsule(160, 220, 104, 148, 110, 188, 6.0, 5.0), SKIN_RAMP)
    shade_mask(c, raster_capsule(160, 220, 58, 152, 58, 166, 5.4, 5.2), KNEE_RAMP)
    shade_mask(c, raster_capsule(160, 220, 104, 142, 104, 156, 5.4, 5.2), KNEE_RAMP)
    shoe_stamp(c, (54, 204))
    shoe_stamp(c, (112, 192), flip=True)
    ground_shadow(c, 80, 210, 28, 5)
    silhouette_rim(c)
    return c


def draw_title_wide() -> Canvas:
    """896x504 native (2x -> 1792x1008). Safe x 259..636, y 63..441."""
    w, h = 896, 504
    c = Canvas(w, h)
    for y in range(int(h * 0.62), h):
        for x in range(w):
            c.put(x, y, "FLOOR0" if ((x // 8) + (y // 8)) % 2 == 0 else "FLOOR1")
    _brick_wall(c, 0, 0, w, int(h * 0.64))
    for y in range(70, 160):
        for x in range(360, 540):
            if c.get(x, y) in ("BRICK1", "BRICK2"):
                c.put(x, y, "BRICK0")
    for y in range(300, 400):
        for x in range(220, 676):
            c.put(x, y, "WOOD1" if ((y // 6) % 2) == 0 else "WOOD2")
    for x in range(220, 676):
        c.put(x, 300, "AMB2")
    bx, by = 408, 88
    for y in range(by, by + 32):
        c.span(y, bx, bx + 80, "STEEL0" if y % 2 == 0 else "STEEL1")
    for lx in (bx + 12, bx + 40, bx + 68):
        for dy in range(-7, 8):
            for dx in range(-7, 8):
                if dx * dx + dy * dy <= 49:
                    c.put(lx + dx, by + 16 + dy, "LAMP" if dx * dx + dy * dy <= 16 else "WHT1")
    from pixel_engine import text5_scaled

    text5_scaled(c, 268, 130, "THREE WHITE LIGHTS", "WHT1", 3, shadow="BAR0")
    text5_scaled(c, 330, 156, "IRON & AMBER ARCADE", "AMB1", 2, shadow="AMB0")
    reed = draw_reed_rear()
    c.blit(reed, 368, 170)
    return c


def draw_platform() -> Canvas:
    """640x360 native (2x -> 1280x720). Wood in ~62–80% height."""
    w, h = 640, 360
    c = Canvas(w, h)
    _brick_wall(c, 0, 0, w, int(h * 0.62))
    # darker band behind lights
    for y in range(20, 90):
        for x in range(260, 380):
            if c.get(x, y) in ("BRICK1", "BRICK2"):
                c.put(x, y, "BRICK0")
    for y in range(int(h * 0.62), h):
        for x in range(w):
            c.put(x, y, "FLOOR0" if ((x // 6) + (y // 6)) % 2 == 0 else "FLOOR1")
    # platform wood 62–80%
    y0, y1 = int(h * 0.62), int(h * 0.82)
    for y in range(y0, y1):
        for x in range(80, w - 80):
            c.put(x, y, ("WOOD0", "WOOD1", "WOOD2")[(y - y0) // 5 % 3])
    for x in range(80, w - 80):
        c.put(x, y0, "AMB2")
    # lights
    bx, by = 280, 28
    for y in range(by, by + 28):
        c.span(y, bx, bx + 80, "STEEL0")
    for lx in (bx + 12, bx + 40, bx + 68):
        for dy in range(-6, 7):
            for dx in range(-6, 7):
                if dx * dx + dy * dy <= 36:
                    c.put(lx + dx, by + 14 + dy, "LAMP" if dx * dx + dy * dy <= 12 else "WHT1")
    return c


def draw_model_sheet() -> Canvas:
    """>=960 wide documented model page."""
    w, h = 960, 540
    c = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            c.put(x, y, "OUT")
    text5(c, 12, 8, "REED HALE  FICTIONAL  NO LIKENESS", "AMB2")
    text5(c, 12, 16, "GATE 1 SAMPLE  160 LATTICE  IRON AMBER V2", "AMB1")
    # expression row
    x = 16
    for name in ("NEUTRAL", "BRACE", "STRAIN", "EXHALE", "GRIN", "SLACK"):
        face_stamp(c, (x, 32), name)  # type: ignore[arg-type]
        text5(c, x, 54, name[:6], "WHT1")
        x += 28
    # standing idle
    idle, _ = draw_lifter(idle_pose(1))
    c.blit(idle, 8, 80)
    text5(c, 20, 250, "STAND", "AMB1")
    sq, _ = draw_lifter(squat_pose(3, False))
    c.blit(sq, 180, 80)
    text5(c, 200, 250, "SQUAT HOLE", "AMB1")
    sqm, _ = draw_lifter(squat_pose(3, True))
    c.blit(sqm, 360, 80)
    text5(c, 380, 250, "SQUAT MAX", "AMB1")
    d1, _ = draw_lifter(deadlift_pose(1, False))
    c.blit(d1, 540, 80)
    text5(c, 560, 250, "DL SETUP", "AMB1")
    d6, _ = draw_lifter(deadlift_pose(6, False))
    c.blit(d6, 720, 80)
    text5(c, 740, 250, "DL LOCK", "AMB1")
    card = draw_squat_card(False)
    # place card at 2x so it reads on the sheet
    for y in range(52):
        for x in range(52):
            n = card.p[y][x]
            if n:
                c.put(20 + x, 280 + y, n)
    text5(c, 20, 336, "SQUAT CARD 52", "AMB1")
    text5(c, 12, 360, "ANCHORS: WEDGE BEARD BROW CHEVRON BELT SLEEVES WRAPS 52:36", "WHT0")
    text5(c, 12, 372, "PALETTE IRON-AMBER-V2  BINARY ALPHA  NO TRACE  NO LIKENESS", "WHT0")
    return c
