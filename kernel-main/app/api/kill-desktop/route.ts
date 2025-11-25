import { killDesktop } from "@/lib/e2b/utils";

async function handleKillDesktop(request: Request) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get("sandboxId");

  const noCacheHeaders = {
    "Cache-Control": "no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store",
    "Vary": "*",
  };

  if (!sandboxId) {
    return new Response("No sandboxId provided", { 
      status: 400,
      headers: noCacheHeaders,
    });
  }

  try {
    await killDesktop(sandboxId);
    return new Response("Desktop killed successfully", { 
      status: 200,
      headers: noCacheHeaders,
    });
  } catch (error) {
    console.error(`Failed to kill desktop with ID: ${sandboxId}`, error);
    return new Response("Failed to kill desktop", { 
      status: 500,
      headers: noCacheHeaders,
    });
  }
}

// Handle POST requests
export async function POST(request: Request) {
  return handleKillDesktop(request);
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