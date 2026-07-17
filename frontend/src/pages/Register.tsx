import { useAuth } from "../auth/auth-context";
import { AuthForm } from "../components/AuthForm";

export default function Register() {
  const { register } = useAuth();
  return (
    <AuthForm
      title="Create account"
      submitLabel="Create account"
      onSubmit={register}
      altPrompt="Already have an account?"
      altLinkLabel="Log in"
      altLinkTo="/login"
    />
  );
}
