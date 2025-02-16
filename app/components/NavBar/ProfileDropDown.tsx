import React from "react";
import Link from "next/link";
import Image from "next/image";
import { createUser } from "@/app/lib/queries";
import { auth, signOut } from "@/auth";

const ProfileDropDown = async () => {
  const session = await auth();
  const user = session?.user;
  const userImageDimension = 52;

  return (
    <>
      {await createUser(user!.name!, user!.email!)}
      <div className="dropdown dropdown-end">
        <div
          tabIndex={0}
          role="button"
          className="btn btn-ghost btn-circle avatar"
        >
          <div className="w-10 rounded-full">
            <Image alt="user image" src={user!.image!} width={userImageDimension} height={userImageDimension}/>
          </div>
        </div>
        <ul
          tabIndex={0}
          className={`menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-${userImageDimension} p-2 shadow`}
        >
          <li>
            <Link href="/profile" className="justify-between">
              Profile
            </Link>
          </li>
          <li>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button>Sign out</button>
            </form>
          </li>
        </ul>
      </div>
    </>
  );
};

export default ProfileDropDown;
