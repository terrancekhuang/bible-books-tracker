import React from "react";
import { auth, signIn, signOut } from "@/auth";
import { createUser } from "@/app/lib/queries";

const AuthenticationButton = async () => {
  const session = await auth();
  const user = session?.user;

  return user ? (
    <>
      {user && (await createUser(user.name!, user.email!))}
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button className="btn">Sign out</button>
      </form>
    </>
  ) : (
    <>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button className="btn">Sign in</button>
      </form>
    </>
  );
};

export default AuthenticationButton;
