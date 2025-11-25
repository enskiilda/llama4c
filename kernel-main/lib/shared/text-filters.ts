export function removeJsonFromText(text: string): string {
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
