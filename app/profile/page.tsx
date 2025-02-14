import { auth, signIn, signOut } from "@/auth";
import { createUser } from "@/app/lib/queries";

export default async function SignIn() {
  const session = await auth();
  const user = session?.user;

  return user ? (
    <>
      {user && await createUser(user.name!, user.email!)}
      <h1 className="text-xl font-bold p-4">Welcome, {user.name}!</h1>
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button className="btn btn-neutral m-4">Sign out</button>
      </form>
    </>
  ) : (
    <>
      <h1 className="text-xl font-bold p-4">You are not signed in.</h1>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button className="btn btn-neutral m-4">Sign in</button>
      </form>
    </>
  );
}
