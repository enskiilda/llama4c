"use client";

import OpenAI from "openai";
import { getDesktop as getDesktopServer, getDesktopURL as getDesktopURLServer, killDesktop as killDesktopServer } from "./e2b/utils";
import { NVIDIA_API_KEY, NVIDIA_MODEL, NVIDIA_BASE_URL } from "./shared/nvidia-config";
import { INSTRUCTIONS, tools } from "./shared/computer-tools";
import { removeJsonFromText } from "./shared/text-filters";

const nvidia = new OpenAI({
  apiKey: NVIDIA_API_KEY,
  baseURL: NVIDIA_BASE_URL,
  dangerouslyAllowBrowser: true,
});

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getDesktop(id?: string) {
  return await getDesktopServer(id);
}

export async function getDesktopURL(id?: string) {
  return await getDesktopURLServer(id);
}

export async function killDesktop(id: string) {
  return await killDesktopServer(id);
}

