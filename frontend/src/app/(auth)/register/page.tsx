import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Create account</h2>
        <p className="mt-1 text-sm text-[#6B6B6B]">Fill in your details to get started.</p>
      </div>
      <RegisterForm />
    </div>
  );
}
