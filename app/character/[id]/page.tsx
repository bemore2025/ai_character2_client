import Image from "next/image";
import { createClient } from "@/utils/supabase/server";
import { Character } from "./types";
import CharacterInteraction from "./components/CharacterInteraction";

async function getCharacterByOrder(orderValue: number): Promise<Character | null> {
  try {
    const supabase = await createClient();

    const { data: character, error } = await supabase
      .from('character')
      .select('*')
      .eq('id', orderValue)
      .single();

    if (error) {
      return null;
    }

    return character as Character;
  } catch (error) {
    return null;
  }
}

interface CharacterPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CharacterPage({ params, searchParams }: CharacterPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const existingImage = resolvedSearchParams.existingImage as string | undefined;
  
  // URL의 마지막 숫자를 order 값으로 사용
  const orderValue = parseInt(id);
  
  // order 값이 유효하지 않으면 에러 처리
  if (isNaN(orderValue)) {
    return (
      <div className="w-full h-screen relative flex flex-col items-center justify-center">
        <Image
          src="/bg2.webp"
          alt="background"
          fill
          className="object-cover z-0"
          priority
          unoptimized
        />
        <div className="z-30 text-center">
          <div className="text-[120px] font-bold text-[#481F0E]">
            잘못된 캐릭터 번호입니다
          </div>
        </div>
      </div>
    );
  }

  // Supabase에서 order 값으로 캐릭터 조회
  const character = await getCharacterByOrder(orderValue);

  return (
    <div className="w-full h-screen relative flex flex-col items-center justify-between">
      <Image
        src="/bg2.webp"
        alt="background"
        fill
        className="object-cover z-0"
        priority
        unoptimized
      />

      {/* 클라이언트 컴포넌트에 캐릭터 데이터 전달 */}
      <CharacterInteraction character={character} characterId={id} existingImage={existingImage} />
    </div>
  );
} 