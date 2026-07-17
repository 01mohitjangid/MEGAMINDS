import { useAuth } from "../auth/auth-context";
import { AuthForm } from "../components/AuthForm";

export default function Login() {
  const { login } = useAuth();
  return (
    <AuthForm
      title="Log in"
      submitLabel="Log in"
      onSubmit={login}
      altPrompt="Need an account?"
      altLinkLabel="Register"
      altLinkTo="/register"
    />
  );
}
