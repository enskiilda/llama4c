
import OpenAI from "openai";
import Kernel from "@onkernel/sdk";
import { killDesktop, getDesktop } from "@/lib/e2b/utils";
import { resolution } from "@/lib/e2b/tool";
import { parseTextToolCall } from './route_parser';

// NVIDIA AI Configuration - HARDCODED
const NVIDIA_API_KEY = "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";
const NVIDIA_MODEL = "meta/llama-4-scout-17b-16e-instruct";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

// Kernel Configuration - HARDCODED
const KERNEL_API_KEY = "sk_0021cd32-adcb-481c-b6a7-e2fe7da7eca6.xb2nSbLBkTdEbe3DLKfFthN3rCd0DMSwuWhR3y7fg2s";
const kernelClient = new Kernel({ apiKey: KERNEL_API_KEY });

export const runtime = 'nodejs';
export const maxDuration = 3600;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INSTRUCTIONS = `Jesteś Operatorem - zaawansowanym asystentem AI, który może bezpośrednio kontrolować przeglądarkę chromium, aby wykonywać zadania użytkownika.

🔴 ABSOLUTNIE ZABRONIONE - NIGDY NIE RÓB TEGO:
- NIGDY nie wysyłaj surowego JSON w wiadomościach tekstowych do użytkownika
- NIGDY nie pokazuj użytkownikowi struktur typu {"action": "screenshot"} w tekście
- NIGDY nie wypisuj współrzędnych w formacie [512, 384] w wiadomościach do użytkownika
- Jeśli chcesz opisać akcję, pisz normalnym językiem: "klikam w pasek adresu" zamiast pokazywać JSON

🔴 KRYTYCZNIE WAŻNE - PRACA KROK PO KROKU:

1. JEDNA AKCJA NA RAZ - Wykonuj TYLKO JEDNĄ akcję w jednej odpowiedzi
2. OSOBNE ELEMENTY - Wiadomość tekstowa i akcja to DWA RÓŻNE ELEMENTY - NIGDY NIE ŁĄCZ ICH
3. KOLEJNOŚĆ:
   a) Najpierw napisz krótką wiadomość co robisz
   b) Potem wywołaj JEDNĄ akcję computer_use(...)
   c) ZATRZYMAJ SIĘ - poczekaj na wynik
   d) Dopiero po otrzymaniu wyniku (szczególnie screenshota) kontynuuj
4. NIGDY NIE PISZ WIELU AKCJI - Tylko jedna computer_use() na odpowiedź
5. NIGDY NIE PLANUJ Z WYPRZEDZENIEM - Nie wypisuj całego planu akcji, rób krok po kroku

PRZYKŁAD PRAWIDŁOWEJ PRACY:
Twoja odpowiedź: "Dobra, zaraz zrobię zrzut ekranu żeby zobaczyć co mamy na ekranie.
computer_use("screenshot")"
[SYSTEM WYKONA SCREENSHOT I PRZEŚLE CI OBRAZ]
Twoja następna odpowiedź: "Widzę przeglądarkę. Teraz kliknę w pasek adresu.
computer_use("left_click", 512, 50)"
[SYSTEM WYKONA KLIKNIĘCIE]
Twoja następna odpowiedź: computer_use("screenshot")
[itd...]

Rozdzielczość desktop: ${resolution.x}×${resolution.y} pikseli

Dostępne akcje przez computer_use:
screenshot, left_click, right_click, double_click, mouse_move, type, key, scroll, left_click_drag, wait

Kończenie: napisz !isfinish na końcu wiadomości gdy zadanie ukończone.`;

function removeJsonFromText(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  cleaned = cleaned.replace(/\{[^\}]*$/gm, ' ');
  cleaned = cleaned.replace(/\{[^\}]*\}/g, ' ');
  cleaned = cleaned.replace(/\{.*$/gm, ' ');
  cleaned = cleaned.replace(/computer_use\s*\([^)]*\)/gi, ' ');
  cleaned = cleaned.replace(/bash\s*\([^)]*\)/gi, ' ');
  cleaned = cleaned.replace(/update_workflow\s*\([^)]*\)/gi, ' ');
  cleaned = cleaned.replace(/screenshot\s*\([^)]*\)/gi, ' ');
  cleaned = cleaned.replace(/computer_use\s*\(.*$/gi, ' ');
  cleaned = cleaned.replace(/bash\s*\(.*$/gi, ' ');
  cleaned = cleaned.replace(/update_workflow\s*\(.*$/gi, ' ');
  cleaned = cleaned.replace(/\bcomputer_use\b/gi, ' ');
  cleaned = cleaned.replace(/\bupdate_workflow\b/gi, ' ');
  cleaned = cleaned.replace(/\bcomputer\s*$/gmi, ' ');
  cleaned = cleaned.replace(/["'][a-zA-Z_]+["']\s*:\s*["'][^"']*["']/g, ' ');
  cleaned = cleaned.replace(/["'][a-zA-Z_]+["']\s*:/g, ' ');
  cleaned = cleaned.replace(/\[\s*\d+\s*,\s*\d+\s*\]/g, ' ');
  cleaned = cleaned.replace(/\[\s*\d+[^\]]*$/g, ' ');
  cleaned = cleaned.replace(/["']?name["']?\s*:/gi, ' ');
  cleaned = cleaned.replace(/["']?parameters["']?\s*:/gi, ' ');
  cleaned = cleaned.replace(/["']?action["']?\s*:/gi, ' ');
  cleaned = cleaned.replace(/["']?coordinate["']?\s*:/gi, ' ');
  cleaned = cleaned.replace(/!isfinish/gi, ' ');
  cleaned = cleaned.replace(/!isf[a-z]*/gi, ' ');
  cleaned = cleaned.replace(/!is[a-z]*/gi, ' ');
  cleaned = cleaned.replace(/^[\{\["'].*/gm, ' ');
  cleaned = cleaned.replace(/\{assistant/gi, ' ');
  cleaned = cleaned.replace(/\{user/gi, ' ');
  cleaned = cleaned.replace(/\{\s*$/gm, ' ');
  cleaned = cleaned.replace(/^\s*\{/gm, ' ');
  cleaned = cleaned.replace(/\s+\{\s+/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  cleaned = cleaned.trim();
  
  if (!cleaned || cleaned.match(/^\s*$/)) {
    return '';
  }
  
  return cleaned;
}

export async function POST(request: Request) {
  const { messages, sandboxId } = await request.json();

  const desktop = await getDesktop(sandboxId);

  const encoder = new TextEncoder();
  let isStreamClosed = false;
  let messageCounter = 0; // Licznik wiadomości dla unikalnych ID

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: any) => {
        if (isStreamClosed) return;
        try {
          const jsonLine = JSON.stringify(event) + "\n";
          const chunk = encoder.encode(jsonLine);
          controller.enqueue(chunk);
          // Force immediate flush - no buffering
          if ((controller as any).flush) {
            (controller as any).flush();
          }
        } catch (err) {
          console.error("Error sending event:", err);
        }
      };

      const sendText = (text: string) => {
        if (isStreamClosed) return;
        try {
          // Add newline after text so frontend can process it immediately
          const chunk = encoder.encode(text + "\n");
          controller.enqueue(chunk);
          // Force immediate flush - no buffering
          if ((controller as any).flush) {
            (controller as any).flush();
          }
        } catch (err) {
          console.error("Error sending text:", err);
        }
      };

      try {
        const nvidia = new OpenAI({
          apiKey: NVIDIA_API_KEY,
          baseURL: NVIDIA_BASE_URL,
        });

        // Clean messages for NVIDIA API compatibility
        const cleanedMessages = messages.map((msg: any) => {
          const { toolCalls, ...cleanMsg } = msg;
          // NVIDIA requires content to be a string, not null/undefined
          if (cleanMsg.content === null || cleanMsg.content === undefined) {
            cleanMsg.content = "";
          }
          // Convert toolCalls (camelCase) to tool_calls (snake_case) for NVIDIA
          if (toolCalls) {
            return { ...cleanMsg, tool_calls: toolCalls };
          }
          return cleanMsg;
        });

        const chatHistory: any[] = [
          { 
            role: "system", 
            content: INSTRUCTIONS
          },
          ...cleanedMessages,
        ];

        const tools = [
          {
            type: "function" as const,
            function: {
              name: "computer_use",
              description: "Control the computer desktop by performing actions like clicking, typing, taking screenshots, etc.",
              parameters: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: ["screenshot", "left_click", "right_click", "double_click", "mouse_move", "type", "key", "scroll", "wait", "left_click_drag"],
                    description: "The action to perform on the computer"
                  },
                  coordinate: {
                    type: "array",
                    items: { type: "number" },
                    description: "X, Y coordinates for click/move actions (e.g., [512, 384])"
                  },
                  text: {
                    type: "string",
                    description: "Text to type or key to press"
                  },
                  start_coordinate: {
                    type: "array",
                    items: { type: "number" },
                    description: "Starting coordinates for drag action"
                  },
                  delta_x: {
                    type: "number",
                    description: "Horizontal scroll delta"
                  },
                  delta_y: {
                    type: "number",
                    description: "Vertical scroll delta"
                  },
                  duration: {
                    type: "number",
                    description: "Duration in seconds for wait action"
                  }
                },
                required: ["action"]
              }
            }
          }
        ];

        while (true) {

          const stream = await nvidia.chat.completions.create({
            model: NVIDIA_MODEL,
            messages: chatHistory,
            temperature: 0.7,
            top_p: 0.95,
            stream: true,
            tools: tools,
            tool_choice: "auto",
          });

          let fullText = "";
          let toolCalls: any[] = [];
          let lastSentTextLength = 0; // Track how much text we've already sent

          for await (const chunk of stream) {
            if (chunk.choices && chunk.choices.length > 0) {
              const choice = chunk.choices[0];
              const delta = choice.delta;

              if (delta.content) {
                fullText += delta.content;
                
                // Filter entire fullText accumulated so far
                const filteredFullText = removeJsonFromText(fullText);
                
                // Send only the NEW part (difference from last sent text)
                if (filteredFullText.length > lastSentTextLength) {
                  const newContent = filteredFullText.substring(lastSentTextLength);
                  
                  if (newContent) {
                    sendText(newContent);
                  }
                  
                  lastSentTextLength = filteredFullText.length;
                }
              }

              // Handle tool calls - NVIDIA może zwracać w różnych formatach
              if (delta.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index ?? 0;

                  if (!toolCalls[index]) {
                    toolCalls[index] = {
                      id: toolCallDelta.id || `call_${Date.now()}_${index}`,
                      name: "",
                      arguments: "",
                    };
                  }

                  // Update name if provided
                  if (toolCallDelta.function?.name) {
                    toolCalls[index].name = toolCallDelta.function.name;
                  }

                  // Append arguments
                  if (toolCallDelta.function?.arguments) {
                    toolCalls[index].arguments += toolCallDelta.function.arguments;
                  }
                }
              }
            }
          }
          
          // Filter out empty tool calls
          toolCalls = toolCalls.filter(tc => tc && tc.name);
          
          // Fix malformed JSON arguments from NVIDIA streaming
          toolCalls = toolCalls.map(tc => {
            if (tc.arguments) {
              let fixedArgs = tc.arguments;
              
              // Remove any trailing incomplete parts
              fixedArgs = fixedArgs.trim();
              
              // Count braces to find if JSON is incomplete
              const openBraces = (fixedArgs.match(/\{/g) || []).length;
              const closeBraces = (fixedArgs.match(/\}/g) || []).length;
              
              // If more opening braces than closing, add missing closing braces
              if (openBraces > closeBraces) {
                const missing = openBraces - closeBraces;
                fixedArgs += '}'.repeat(missing);
              }
              
              // Fix common NVIDIA streaming bugs:
              // 1. "action": "left_click, "coordinate" -> "action": "left_click", "coordinate"
              fixedArgs = fixedArgs.replace(/"([^"]+)", "([^"]+)": /g, '"$1", "$2": ');
              
              // 2. "coordinate": []512 -> "coordinate": [512
              fixedArgs = fixedArgs.replace(/: \[\](\d)/g, ': [$1');
              
              // 3. [512, 384 -> [512, 384]
              fixedArgs = fixedArgs.replace(/\[(\d+),\s*(\d+)(?!\])/g, '[$1, $2]');
              
              // 4. Ensure arrays are properly closed
              if (fixedArgs.includes('[') && !fixedArgs.includes(']')) {
                const lastBracket = fixedArgs.lastIndexOf('[');
                const afterBracket = fixedArgs.substring(lastBracket + 1);
                // If we have numbers after [, close the array
                if (/\d/.test(afterBracket)) {
                  fixedArgs = fixedArgs.replace(/\[([^\]]+)$/, '[$1]');
                }
              }
              
              // Verify it's valid JSON
              try {
                JSON.parse(fixedArgs);
                tc.arguments = fixedArgs;
              } catch (e) {
                console.error('[JSON FIX ERROR]', e, 'Original:', tc.arguments, 'Fixed:', fixedArgs);
                // If still invalid, try to salvage what we can
                // Extract action at minimum
                const actionMatch = tc.arguments.match(/"action":\s*"([^"]+)"/);
                if (actionMatch) {
                  const action = actionMatch[1];
                  
                  // Try to extract coordinate if present
                  const coordMatch = tc.arguments.match(/(\d+),\s*(\d+)/);
                  if (coordMatch && (action.includes('click') || action.includes('move'))) {
                    tc.arguments = JSON.stringify({
                      action: action,
                      coordinate: [parseInt(coordMatch[1]), parseInt(coordMatch[2])]
                    });
                  } else if (action === 'screenshot' || action === 'wait') {
                    tc.arguments = JSON.stringify({ action: action });
                  } else {
                    // Try to extract text
                    const textMatch = tc.arguments.match(/"text":\s*"([^"]+)"/);
                    if (textMatch) {
                      tc.arguments = JSON.stringify({
                        action: action,
                        text: textMatch[1]
                      });
                    } else {
                      tc.arguments = JSON.stringify({ action: action });
                    }
                  }
                }
              }
            }
            return tc;
          });
          

          let textBeforeAction = "";
          if (toolCalls.length === 0 && fullText) {
            const parsed = parseTextToolCall(fullText);
            if (parsed) {
              toolCalls = [parsed.toolCall];
              textBeforeAction = parsed.textBefore;
            }
          }

          // Check if AI wants to finish - look for !isfinish command
          const wantsToFinish = fullText && fullText.includes('!isfinish');

          if (toolCalls.length > 0) {
            // AI is calling tools - EXECUTE ONLY FIRST ONE, then break loop
            // This ensures ONE action per iteration
            const firstToolCall = toolCalls[0];
            
            // KROK 1: Wyślij finish event aby frontend zamknął obecną wiadomość tekstową
            // (tekst został już wystreamowany przez sendText)
            sendEvent({
              type: "finish",
            });
            
            messageCounter++;
            
            // KROK 2: Dodaj tekst do historii czatu (tylko jeśli był)
            if (textBeforeAction && textBeforeAction.trim()) {
              chatHistory.push({
                role: "assistant",
                content: textBeforeAction,
              });
            } else if (fullText && fullText.trim()) {
              // Jeśli nie było parsed textBefore, użyj pełnego tekstu
              const filteredText = removeJsonFromText(fullText);
              if (filteredText && filteredText.trim()) {
                chatHistory.push({
                  role: "assistant",
                  content: filteredText,
                });
              }
            }
            
            // KROK 3: Przygotuj tool call message - JAKO OSOBNA WIADOMOŚĆ
            messageCounter++;
            
            const assistantMessage: any = {
              role: "assistant",
              content: "",  // NO TEXT HERE - action only
              tool_calls: [{
                id: firstToolCall.id,
                type: "function",
                function: {
                  name: firstToolCall.name,
                  arguments: firstToolCall.arguments,
                },
              }],
            };
            chatHistory.push(assistantMessage);

            const toolCall = firstToolCall;
            const parsedArgs = JSON.parse(toolCall.arguments);
            const toolName = toolCall.name === "computer_use" ? "computer" : (toolCall.name === "update_workflow" ? "workflow" : "bash");

            sendEvent({
              type: "tool-input-available",
              toolCallId: toolCall.id,
              toolName: toolName,
              input: parsedArgs,
            });

            let screenshotData: any = null;
            const toolResult = await (async () => {
              try {
                let resultData: any = { type: "text", text: "" };
                let resultText = "";

                if (toolCall.name === "computer_use") {
                  const action = parsedArgs.action;

                  switch (action) {
                    case "screenshot": {
                      const response = await kernelClient.browsers.computer.captureScreenshot(desktop.session_id);
                      const blob = await response.blob();
                      const buffer = Buffer.from(await blob.arrayBuffer());
                      
                      const timestamp = new Date().toISOString();
                      const width = resolution.x;
                      const height = resolution.y;
                      const base64Image = buffer.toString("base64");

                      screenshotData = {
                        type: "image",
                        data: base64Image,
                        timestamp: timestamp,
                        width: width,
                        height: height
                      };

                      // Format for Vision API - include image in content
                      resultText = `Screenshot taken at ${timestamp}

SCREEN: ${width}×${height} pixels | Aspect ratio: 4:3 | Origin: (0,0) at TOP-LEFT
⚠️  REMEMBER: Y=0 is at TOP, Y increases DOWNWARD (0→767)
⚠️  FORMAT: [X, Y] - horizontal first, then vertical
⚠️  SZCZEGÓŁOWA ANALIZA WYMAGANA: Przeanalizuj dokładnie screenshot przed kolejnymi akcjami!`;

                      resultData = {
                        type: "image",
                        data: base64Image,
                      };

                      sendEvent({
                        type: "screenshot-update",
                        screenshot: base64Image,
                      });
                      break;
                    }
                    case "wait": {
                      const duration = parsedArgs.duration || 1;
                      resultText = `Waited for ${duration} seconds`;
                      resultData = { type: "text", text: resultText };
                      break;
                    }
                    case "left_click": {
                      const [x, y] = parsedArgs.coordinate;
                      await kernelClient.browsers.computer.clickMouse(desktop.session_id, {
                        x: Math.round(x),
                        y: Math.round(y),
                        button: 'left',
                      });
                      resultText = `Left clicked at coordinates (${Math.round(x)}, ${Math.round(y)})`;
                      resultData = { type: "text", text: resultText };
                      break;
                    }
                    case "double_click": {
                      const [x, y] = parsedArgs.coordinate;
                      await kernelClient.browsers.computer.clickMouse(desktop.session_id, {
                        x: Math.round(x),
                        y: Math.round(y),
                        button: 'left',
                        num_clicks: 2,
                      });
                      resultText = `Double clicked at coordinates (${Math.round(x)}, ${Math.round(y)})`;
                      resultData = { type: "text", text: resultText };
                      break;
                    }
                    case "right_click": {
                      const [x, y] = parsedArgs.coordinate;
                      await kernelClient.browsers.computer.clickMouse(desktop.session_id, {
                        x: Math.round(x),
                        y: Math.round(y),
                        button: 'right',
                      });
                      resultText = `Right clicked at coordinates (${Math.round(x)}, ${Math.round(y)})`;
                      resultData = { type: "text", text: resultText };
                      break;
                    }
                    case "mouse_move": {
                      const [x, y] = parsedArgs.coordinate;
                      await kernelClient.browsers.computer.moveMouse(desktop.session_id, {
                        x: Math.round(x),
                        y: Math.round(y),
                      });
                      resultText = `Moved mouse to ${Math.round(x)}, ${Math.round(y)}`;
                      resultData = { type: "text", text: resultText };
                      break;
                    }
                    case "type": {
                      const textToType = parsedArgs.text;
                      await kernelClient.browsers.computer.typeText(desktop.session_id, {
                        text: textToType,
                      });
                      resultText = `Typed: ${textToType}`;
                      resultData = { type: "text", text: resultText };
                      break;
                    }
                    case "key": {
                      let keyToPress = parsedArgs.text;
                      
                      // OnKernel uses X11 keysym names - convert common variants to X11 format
                      if (keyToPress === "Enter" || keyToPress === "enter") {
                        keyToPress = "Return";
                      }
                      
                      
                      await kernelClient.browsers.computer.pressKey(desktop.session_id, {
                        keys: [keyToPress],
                      });
                      resultText = `Pressed key: ${parsedArgs.text}`;
                      resultData = { type: "text", text: resultText };
                      break;
                    }
                    case "scroll": {
                      const [x, y] = parsedArgs.coordinate || [512, 384];
                      const delta_x = parsedArgs.delta_x || 0;
                      const delta_y = parsedArgs.delta_y || 0;
                      await kernelClient.browsers.computer.scroll(desktop.session_id, {
                        x: Math.round(x),
                        y: Math.round(y),
                        delta_x: Math.round(delta_x),
                        delta_y: Math.round(delta_y),
                      });
                      resultText = `Scrolled at (${Math.round(x)}, ${Math.round(y)}) with delta_x: ${Math.round(delta_x)}, delta_y: ${Math.round(delta_y)}`;
                      resultData = { type: "text", text: resultText };
                      break;
                    }
                    case "left_click_drag": {
                      const [startX, startY] = parsedArgs.start_coordinate;
                      const [endX, endY] = parsedArgs.coordinate;
                      await kernelClient.browsers.computer.dragMouse(desktop.session_id, {
                        path: [[Math.round(startX), Math.round(startY)], [Math.round(endX), Math.round(endY)]],
                        button: 'left',
                      });
                      resultText = `Dragged from (${Math.round(startX)}, ${Math.round(startY)}) to (${Math.round(endX)}, ${Math.round(endY)})`;
                      resultData = { type: "text", text: resultText };
                      break;
                    }
                    default: {
                      resultText = `Unknown action: ${action}`;
                      resultData = { type: "text", text: resultText };
                      console.warn("Unknown action:", action);
                    }
                  }

                  sendEvent({
                    type: "tool-output-available",
                    toolCallId: toolCall.id,
                    output: resultData,
                  });

                  return {
                    tool_call_id: toolCall.id,
                    role: "tool",
                    content: resultText,
                    image: action === "screenshot" ? resultData.data : undefined,
                  };
                } else if (toolCall.name === "update_workflow") {
                  // Handle workflow updates
                  const workflowData = parsedArgs;
                  
                  // Send workflow update event to frontend
                  sendEvent({
                    type: "workflow-update",
                    workflow: workflowData,
                    timestamp: new Date().toISOString(),
                  });

                  sendEvent({
                    type: "tool-output-available",
                    toolCallId: toolCall.id,
                    output: { type: "text", text: "Workflow updated" },
                  });

                  return {
                    tool_call_id: toolCall.id,
                    role: "tool",
                    content: "Workflow updated successfully. Continue with the next action.",
                  };
                } else if (toolCall.name === "bash_command") {
                  const result = await kernelClient.browsers.process.exec(desktop.session_id, {
                    command: parsedArgs.command,
                  });

                  const stdout = result.stdout_b64 ? Buffer.from(result.stdout_b64, 'base64').toString('utf-8') : '';
                  const stderr = result.stderr_b64 ? Buffer.from(result.stderr_b64, 'base64').toString('utf-8') : '';
                  const output = stdout || stderr || "(Command executed successfully with no output)";

                  sendEvent({
                    type: "tool-output-available",
                    toolCallId: toolCall.id,
                    output: { type: "text", text: output },
                  });

                  return {
                    tool_call_id: toolCall.id,
                    role: "tool",
                    content: output,
                  };
                }
              } catch (error) {
                console.error("Error executing tool:", error);
                const errorMsg = error instanceof Error ? error.message : String(error);
                let detailedError = `Error: ${errorMsg}`;

                if (errorMsg.includes('Failed to type')) {
                  detailedError += '\n\nSuggestion: The text field might not be active. Try clicking on the text field first before typing.';
                } else if (errorMsg.includes('Failed to click') || errorMsg.includes('Failed to double click') || errorMsg.includes('Failed to right click')) {
                  detailedError += '\n\nSuggestion: The click action failed. Take a screenshot to see what happened, then try clicking again.';
                } else if (errorMsg.includes('Failed to take screenshot')) {
                  detailedError += '\n\nSuggestion: Screenshot failed. The desktop might be loading. Wait a moment and try again.';
                } else if (errorMsg.includes('Failed to press key')) {
                  detailedError += '\n\nSuggestion: Key press failed. Make sure the correct window is focused.';
                } else if (errorMsg.includes('Failed to move mouse')) {
                  detailedError += '\n\nSuggestion: Mouse movement failed. Try again.';
                } else if (errorMsg.includes('Failed to drag')) {
                  detailedError += '\n\nSuggestion: Drag operation failed. Try again with different coordinates.';
                } else if (errorMsg.includes('Failed to scroll')) {
                  detailedError += '\n\nSuggestion: Scroll failed. Make sure a scrollable window is active.';
                }

                sendEvent({
                  type: "error",
                  errorText: errorMsg,
                });

                return {
                  tool_call_id: toolCall.id,
                  role: "tool",
                  content: detailedError,
                };
              }
            })();

            // Send tool result to chat history
            // Format tool result message
            let toolMessage: any;
            if (screenshotData) {
              // KRYTYCZNE: Screenshot jako TOOL MESSAGE (potwierdzenie akcji)
              toolMessage = {
                role: "tool",
                tool_call_id: toolResult!.tool_call_id,
                content: `Screenshot captured successfully at ${screenshotData.timestamp}`
              };
              chatHistory.push(toolMessage);
              
              // KRYTYCZNE: Screenshot jako USER MESSAGE (obraz do analizy)
              // To sprawi że AI będzie musiał odpowiedzieć analizując obraz
              const userScreenshotMessage = {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Oto screenshot z sandboxa. Przeanalizuj go dokładnie przed podjęciem kolejnej akcji.\n\nSCREEN: ${screenshotData.width}×${screenshotData.height} pixels | Aspect ratio: 4:3 | Origin: (0,0) at TOP-LEFT\n⚠️ REMEMBER: Y=0 is at TOP, Y increases DOWNWARD (0→767)\n⚠️ FORMAT: [X, Y] - horizontal first, then vertical\n⚠️ CO WIDZISZ NA TYM SCREENSHOCIE? OPISZ I PODEJMIJ DECYZJĘ O KOLEJNEJ AKCJI.`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/png;base64,${screenshotData.data}`
                    }
                  }
                ]
              };
              chatHistory.push(userScreenshotMessage);
            } else {
              toolMessage = {
                role: "tool",
                tool_call_id: toolResult!.tool_call_id,
                content: toolResult!.content,
              };
              chatHistory.push(toolMessage);
            }        
            // INFINITE LOOP: Po akcji kontynuujemy automatycznie bez delayów
            
          } else {
            // No tool calls - AI is just sending text
            if (fullText) {
              messageCounter++;
              
              // Normal text message - add to history and continue loop
              chatHistory.push({
                role: "assistant",
                content: fullText,
              });
              
              // Check if AI wants to finish - komenda !isfinish jest już w tekście
              // Po prostu kończymy pętlę
              if (wantsToFinish) {
                break;
              }
            }
            
            // Continue loop - AI will execute next action or send another message
          }
        }
      } catch (error) {
        console.error("Chat API error:", error);
        await killDesktop(sandboxId);
        sendEvent({
          type: "error",
          errorText: String(error),
        });
      } finally {
        if (!isStreamClosed) {
          isStreamClosed = true;
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "Surrogate-Control": "no-store",
      "X-Accel-Buffering": "no",
      "X-Accel-Expires": "0",
      "Transfer-Encoding": "chunked",
      "Connection": "close",
      "Vary": "*",
      "Last-Modified": new Date().toUTCString(),
      "ETag": `"${Date.now()}"`,
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
