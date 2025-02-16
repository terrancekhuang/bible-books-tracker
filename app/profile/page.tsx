import { auth } from "@/auth";
import { createUser } from "@/app/lib/queries";

export default async function SignIn() {
  const session = await auth();
  const user = session?.user;

  {
    if (!user)
      return <h1 className="text-xl font-bold p-4">You are not signed in.</h1>;
  }
  return (
    <>
      {await createUser(user.name!, user.email!)}
      <h1 className="text-xl font-bold p-4">Welcome, {user.name}!</h1>
    </>
  );
}
