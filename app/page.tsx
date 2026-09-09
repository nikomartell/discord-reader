import { MessageFeed } from "@/components/MessageFeed";
import { safeGetRecentMessages } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialMessages = await safeGetRecentMessages(50);

  return (
    <main className="min-h-full bg-zinc-50 dark:bg-black">
      <MessageFeed initialMessages={initialMessages} />
    </main>
  );
}
