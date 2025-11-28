"use client"
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import PasswordModal from "./components/PasswordModal";

export default function Home() {
  const router = useRouter();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 인증 상태 확인
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/check-auth");
        const data = await response.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
        } else {
          setShowPasswordModal(true);
        }
      } catch (error) {
        setShowPasswordModal(true);
      }
    };
    checkAuth();
  }, []);

  const handlePasswordSuccess = () => {
    setShowPasswordModal(false);
    setIsAuthenticated(true);
  };

  const handleClick = () => {
    if (isAuthenticated) {
      router.push("/intro");
    }
  };

  return (
    <div className="w-full h-screen relative flex flex-col items-center justify-between">
      <Image 
        src="/home_bg.jpg" 
        alt="background" 
        fill 
        className="object-cover z-0" 
        priority
        unoptimized
        onClick={handleClick}
      />
      <img src="/logo1.png" alt="" className="absolute bottom-[132px] left-[742.8px] z-10 w-[413px] h-[81px]"/>
      <img src="/logo2.png" alt="" className="absolute bottom-[115px] right-[742.8px] z-10 w-[204px] h-[101px]"/>
      
      {/* <div 
        className="flex flex-col items-center justify-center z-30 mt-[190px]"
      >
        <div 
          className="text-black text-[220px] font-bold text-center" 
          style={{ fontFamily: 'MuseumClassic, serif' }}
        >
          동해를 지켜라!
        </div>
        <div 
          className="text-black text-[260px] font-bold text-center" 
          style={{ fontFamily: 'MuseumClassic, serif' }}
        >
          AI 수군 변신소
        </div>
      </div> */}

      <div
        className="flex flex-col items-center justify-end z-30 absolute bottom-[278px]"
        style={{ fontFamily: 'MuseumClassic, serif' }}
      >
        <div>
          <Button
            className="w-[1550px] h-[280px] text-[128px] text-[#451F0D] bg-[#E4BE50] border-5 border-[#471F0D] rounded-[60px] font-bold hover:bg-[#D4AE40] transition-colors duration-200"
            onClick={handleClick}
            disabled={!isAuthenticated}
          >
            화면을 눌러주세요
          </Button>
        </div>

        <div
          className="w-full h-[136px] text-[48px] text-black drop-shadow-lg mt-[41px] font-bold"
          style={{ lineHeight: '68px', letterSpacing: '-2%' }}
        >
          <p className="text-center text-[48px]">얼굴을 인식하여 조선 수군으로 변신합니다.</p>
          <p className="text-center text-[48px]">생성된 이미지는 포토카드로 제작할 수 있습니다.</p>
        </div>
      </div>

      <PasswordModal
        isOpen={showPasswordModal}
        onSuccess={handlePasswordSuccess}
      />
    </div>
  );
}
