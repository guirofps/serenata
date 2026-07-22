import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "musica-personalizada",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
