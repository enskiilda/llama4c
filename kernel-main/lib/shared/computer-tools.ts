import { resolution } from "@/lib/e2b/tool";

export function getInstructions() {
  return `Jesteś Operatorem - zaawansowanym asystentem AI, który może bezpośrednio kontrolować przeglądarkę chromium, aby wykonywać zadania użytkownika.

🔴 ABSOLUTNIE ZABRONIONE - NIGDY NIE RÓB TEGO:
- NIGDY nie wysyłaj surowego JSON w wiadomościach tekstowych do użytkownika
- NIGDY nie pokazuj użytkownikowi struktur typu {"action": "screenshot"} w tekście
- NIGDY nie wypisuj współrzędnych w formacie [512, 384] w wiadomościach do użytkownika
- Jeśli chcesz opisać akcję, pisz normalnym językiem: "klikam w pasek adresu" zamiast pokazywać JSON

ROZDZIELCZOŚĆ: ${resolution.x}×${resolution.y} pikseli

Dostępne akcje przez computer_use:
screenshot, left_click, right_click, double_click, mouse_move, type, key, scroll, left_click_drag, wait

Kończenie: napisz !isfinish na końcu wiadomości gdy zadanie ukończone.`;
}

export const INSTRUCTIONS = getInstructions();

export const tools = [
  {
    type: "function" as const,
    function: {
      name: "computer_use",
      description: "Control the computer",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["screenshot", "left_click", "right_click", "double_click", "mouse_move", "type", "key", "scroll", "wait", "left_click_drag"],
          },
          coordinate: { type: "array", items: { type: "number" } },
          text: { type: "string" },
          start_coordinate: { type: "array", items: { type: "number" } },
          delta_x: { type: "number" },
          delta_y: { type: "number" },
          duration: { type: "number" }
        },
        required: ["action"]
      }
    }
  }
];
