import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLatestCycle } from "@/lib/queries";
import Form from "next/form";
import { formUpdateReadingCycle } from "@/lib/actions";

export default async function Profile() {
  const session = await auth();
  const user = session?.user;
  const latestCycle = await getLatestCycle(user?.email || "");

  if (!session) {
    redirect("api/auth/signin")
  }
  return (
    <>
      <Form action={formUpdateReadingCycle}>
        <label className="form-control w-full max-w-xs p-2">
          <div className="label-text">Name</div>
          <input
            type="text"
            name="nameInput"
            placeholder="Enter name here"
            defaultValue={user?.name || ""}
            className="input input-bordered w-full max-w-xs"
            disabled={true}
          />
        </label>

        <label className="form-control w-full max-w-xs p-2">
          <div className="label-text">Email</div>
          <input
            type="text"
            name="emailInput"
            placeholder="Enter email here"
            defaultValue={user?.email || ""}
            className="input input-bordered w-full max-w-xs"
            disabled={true}
          />
        </label>

        <label className="form-control w-full max-w-xs p-2">
          <div className="label-text">Time reading the Bible</div>
          <input
            type="number"
            name="readingCycleInput"
            placeholder="Enter number here"
            defaultValue={latestCycle?.reading_cycle}
            className="input input-bordered w-full max-w-xs"
          />
        </label>

        <div className="flex w-1/4 p-2">
          <label className="label-text w-1/2">
            <div>Start Date</div>
            <input
              type="date"
              name="startDateInput"
              className="input input-bordered"
              defaultValue={
                latestCycle?.start_date
                  ? new Date(latestCycle.start_date).toISOString().split("T")[0]
                  : new Date().toISOString().split("T")[0]
              }
            />
          </label>

          <label className="label-text w-1/2">
            <div>Goal Date</div>
            <input
              type="date"
              name="goalDateInput"
              className="input input-bordered"
              defaultValue={
                latestCycle?.start_date
                  ? new Date(latestCycle.goal_date).toISOString().split("T")[0]
                  : new Date().toISOString().split("T")[0]
              }
            />
          </label>
        </div>
        <button type="submit" className="btn btn-outline btn-success m-2">
          Submit
        </button>
      </Form>
    </>
  );
}
