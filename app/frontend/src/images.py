
Action: file_editor create /app/backend/generate_images.py --file-text "\"\"\"One-off script to generate painterly scene images for the scrollytelling
experience using Gemini Nano Banana (via emergentintegrations).

Run from /app/backend:
    python generate_images.py

Images are written to /app/frontend/public/images/.
\"\"\"
import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

OUTPUT_DIR = Path(__file__).resolve().parent.parent / \"frontend\" / \"public\" / \"images\"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_ID = \"gemini-3.1-flash-image-preview\"

STYLE_ANCHOR = (
    \"Painterly semi-realistic illustration, soft hand-painted brushstrokes, muted \"
    \"cinematic palette, volumetric lighting, subtle film grain, moody emotional \"
    \"atmosphere, hand-drawn animation studio aesthetic similar to 'The Breadwinner' \"
    \"by Cartoon Saloon / BOAT, gentle color gradients, rich shadow work, no sharp \"
    \"digital edges, widescreen cinematic 16:9 composition, absolutely NO text, NO \"
    \"letters, NO watermark, NO captions anywhere in the frame.\"
)

SCENES = {
    \"scene_darkness\": (
        \"Almost entirely pitch-black frame. A single faint streak of distant \"
        \"lightning reveals, for a split second, the silhouette of a small lonely \"
        \"house on a hill far away. Heavy rain. Deep indigo-black atmosphere. \"
        \"Hints of charcoal grey clouds.\"
    ),
    \"scene_house\": (
        \"A small lonely two-story wooden house standing alone on a gentle hill at \"
        \"night under a stormy sky. One upstairs window glows with a dim warm \"
        \"orange light — the only light in the scene. Diagonal sheets of rain. \"
        \"Dark violet and cold blue cloud layers with soft lightning glow on the \"
        \"horizon. A lone twisted tree beside the house. No people visible. \"
        \"Distant wide shot, slightly low angle, cinematic.\"
    ),
    \"scene_window\": (
        \"Extreme close-up of an old wooden-framed house window at night. Glass \"
        \"is foggy and wet with diagonal streaks of rain. Warm dim amber light \"
        \"glows faintly from inside, hinting at a child-sized silhouette barely \"
        \"visible through the condensation. Cold blue exterior contrasts the \"
        \"warm interior glow. Raindrops catching light. Painterly texture.\"
    ),
    \"scene_rio_bed\": (
        \"Interior of a small, almost too neat child's bedroom at night. A \"
        \"small child (around 8 years old, soft features, gender-neutral short \"
        \"dark hair) is curled up on a single bed, knees pulled to chest, arms \"
        \"wrapped tight, face partially hidden. Cold pale blue moonlight from a \"
        \"rain-streaked window falls across them. A small wooden desk with a \"
        \"closed notebook and a pencil sits in the corner. Room is tidy, \"
        \"sparse, slightly oppressive. Moody shadows. Wide-ish interior shot.\"
    ),
    \"scene_rio_close\": (
        \"Close-up of the same small child's face in a dim bedroom at night. \"
        \"Eyes wide, reflecting pale blue light from a window. Subtle fear and \"
        \"exhaustion in the expression. Hair softly lit. Background out of \"
        \"focus, deep shadows. Painterly skin textures, cinematic lighting, \"
        \"emotional weight.\"
    ),
    \"scene_classroom\": (
        \"A daytime primary-school classroom with slightly desaturated, washed-\"
        \"out colors. Several cheerful children are mid-laughter and motion in \"
        \"soft motion-blur around the frame. In the very center, one small \"
        \"child (same child as before, short dark hair) sits completely still \"
        \"at a wooden desk, hands folded, looking down. The stillness of the \"
        \"child contrasts the blurred movement around. Soft overcast daylight \"
        \"through tall windows. Chalkboard blurred in background.\"
    ),
    \"scene_trigger\": (
        \"The child's anxious point of view in a classroom. One other kid in \"
        \"the foreground is frozen mid-shout or laugh, mouth open wide, arms \"
        \"up in a joking gesture. The rest of the classroom dissolves into a \"
        \"soft radial blur and slight desaturated vignette. Cold undertones \"
        \"creep in at the edges. A painterly freeze-frame of a small panic \"
        \"moment. No text.\"
    ),
    \"scene_hallway\": (
        \"A narrow, dark wooden-floor hallway inside a modest home at night. \"
        \"At the far end, a door stands slightly ajar, a slice of warm amber \"
        \"light spilling out onto the floor. Long shadows. Painterly moody \"
        \"atmosphere. A small vintage wall clock barely visible. Cold \"
        \"blue-black walls contrasted by the warm leak of light.\"
    ),
    \"scene_notebook\": (
        \"Overhead top-down close-up of an open lined school notebook on a \"
        \"wooden desk. Written in small, slightly trembling child handwriting \"
        \"are short dash-lead lines (but the letters should be indistinct / \"
        \"unreadable scribbles — NOT legible words). A yellow pencil rests \"
        \"beside the page. A soft warm desk-lamp glow from the top-left. \"
        \"Subtle paper grain and shadow. Painterly.\"
    ),
    \"scene_teacher\": (
        \"A kind female primary-school teacher with warm eyes is leaning \"
        \"slightly forward toward a small child seated at a desk, speaking \"
        \"gently. The background classroom is heavily blurred. Soft natural \"
        \"window light falls on the teacher's face. The child is in the \"
        \"foreground, shoulders tense, looking down. Gentle, concerned \"
        \"emotional atmosphere. Painterly.\"
    ),
}


async def generate(name: str, prompt: str) -> None:
    target = OUTPUT_DIR / f\"{name}.png\"
    if target.exists():
        print(f\"[skip] {target.name} already exists\")
        return

    api_key = os.getenv(\"EMERGENT_LLM_KEY\")
    if not api_key:
        raise RuntimeError(\"EMERGENT_LLM_KEY not set\")

    full_prompt = f\"{STYLE_ANCHOR}\n\nScene: {prompt}\"
    chat = (
        LlmChat(
            api_key=api_key,
            session_id=f\"scene-{name}\",
            system_message=\"You are a painterly cinematic illustrator.\",
        )
        .with_model(\"gemini\", MODEL_ID)
        .with_params(modalities=[\"image\", \"text\"])
    )
    msg = UserMessage(text=full_prompt)
    _text, images = await chat.send_message_multimodal_response(msg)
    if not images:
        print(f\"[fail] {name}: no images returned\")
        return
    image_bytes = base64.b64decode(images[0][\"data\"])
    target.write_bytes(image_bytes)
    print(f\"[ok]   wrote {target.name} ({len(image_bytes) // 1024} KB)\")


async def main(only=None) -> None:
    for name, prompt in SCENES.items():
        if only and name not in only:
            continue
        try:
            await generate(name, prompt)
        except Exception as exc:  # noqa: BLE001
            print(f\"[err]  {name}: {exc}\")


if __name__ == \"__main__\":
    subset = sys.argv[1:] or None
    asyncio.run(main(subset))
"
Observation: Create successful: /app/backend/generate_images.py
