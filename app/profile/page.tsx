import { auth, signIn, signOut } from "@/auth";

export default async function SignIn() {
  const session = await auth();
  const user = session?.user;
  return user ? (
    <>
      <h1 className="text-xl font-bold">Welcome, {user.name}!</h1>
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button className="btn btn-neutral">Sign out</button>
      </form>
    </>
  ) : (
    <>
      <h1 className="text-xl font-bold">You are not signed in.</h1>
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button className="btn btn-neutral">Sign in</button>
      </form>
    </>
  );
}
