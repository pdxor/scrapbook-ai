
┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
│ Asset │───▶│ Composition │───▶│ AI Refine │───▶│ Storyboard │
│ Gallery │ │ Canvas │ │ Engine │ │ Timeline │
└─────────────┘ └──────────────┘ └──────────────┘ └──────┬──────┘
│
┌───────────────────▼────────┐
│ Video Buddy │
│ (batch video generation) │
└────────────────────────────┘
Client runs on http://localhost:5173, server on http://localhost:3001.
asset directories
Drop your pre-made assets into these folders and they'll show up in the galleries:
project structure
how the AI refinement actually works
Most AI image tools just yeet your prompt at an API. This one is paranoid about preserving your characters.
The refinement prompt is a wall of constraints:
Identity Lock — the character is treated as a pasted photograph layer. Zero reinterpretation.
Pixel Freeze — 100% of pixels outside the mask must remain identical. No global changes.
Failure Mode — if the model can't complete the task without touching the character, return the image unchanged.
Style Lock — no cinematic grading, no AI stylization. Match existing background exactly.
Edge Rule — blend within 1-2 pixels of mask boundary max. No subject edge modification.
Then the 2-pass pipeline enforces it mechanically: after the AI generates its result, the original subject pixels are composited back on top using a feathered mask. The AI literally cannot change the character — even if it tried, those pixels get overwritten.
license
