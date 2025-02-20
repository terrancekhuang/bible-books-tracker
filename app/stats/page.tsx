import { auth } from "@/auth";
import { redirect } from "next/navigation";
import React from "react";

const page = async () => {
  const session = await auth();
  if (!session) {
    redirect("api/auth/signin");
  }

  return (
    <>
      <h1 className="text-xl font-bold p-4">Stats</h1>
    </>
  );
};

export default page;
