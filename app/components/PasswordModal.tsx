"use client"

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export default function PasswordModal({ isOpen, onSuccess }: PasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError("비밀번호가 일치하지 않습니다.");
        setPassword("");
      }
    } catch (error) {
      setError("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="sm:max-w-[800px] max-w-[90%] p-12 border-2 border-[#471F0D] shadow-2xl"
        style={{ backgroundColor: '#F7D5AA' }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-4xl font-bold text-center mb-4 text-[#451F0D]">
            비밀번호 입력
          </DialogTitle>
          <DialogDescription className="text-2xl text-center text-[#451F0D]">
            계속하려면 비밀번호를 입력해주세요
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full h-20 text-3xl px-6 bg-white border-2 border-[#471F0D] text-gray-900"
              disabled={isLoading}
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-xl mt-3 font-bold">{error}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full h-20 text-3xl bg-[#E4BE50] hover:bg-[#D4AE40] text-[#451F0D] font-bold border-2 border-[#471F0D]"
            disabled={isLoading || !password}
          >
            {isLoading ? "확인 중..." : "확인"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
