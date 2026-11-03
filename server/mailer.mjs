// Resend transport. Nothing is sent unless RESEND_API_KEY is set in Replit Secrets.
export function resendConnected() { return !!process.env.RESEND_API_KEY; }

export async function resendSend({ from, to, subject, html, text, replyTo }) {
  if (!resendConnected()) throw new Error('Resend is not connected (RESEND_API_KEY missing).');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `Resend error ${res.status}`);
  return data.id || null;
}
