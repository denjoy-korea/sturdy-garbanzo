import Game from "@/components/Game";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <Game roomId={roomId.toUpperCase()} />;
}
