import { auth } from "@/auth";
import { createUser } from "@/app/lib/queries";

export default async function SignIn() {
  const session = await auth();
  const user = session?.user;

  return user ? (
    <>
      {user && (await createUser(user.name!, user.email!))}
      <h1 className="text-xl font-bold p-4">Welcome, {user.name}!</h1>
    </>
  ) : (
    <>
      <h1 className="text-xl font-bold p-4">You are not signed in.</h1>
    </>
  );
}
