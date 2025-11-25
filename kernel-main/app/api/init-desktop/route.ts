import { getDesktopURL } from "@/lib/e2b/utils";

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body?.id;
    
    const { streamUrl, id: sessionId } = await getDesktopURL(id);
    
    return Response.json({
      streamUrl,
      id: sessionId,
    }, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store",
        "Vary": "*",
        "Last-Modified": new Date().toUTCString(),
        "ETag": `"${Date.now()}"`,
      }
    });
  } catch (error) {
    console.error("Failed to initialize desktop:", error);
    return Response.json(
      { error: "Failed to initialize desktop" },
      { 
        status: 500,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        }
      }
    );
  }
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
