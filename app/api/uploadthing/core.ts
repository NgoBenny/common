import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { assertParticipation } from "@/app/lib/restrictions";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  imageUploader: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    // Set permissions and file types for this FileRoute
    .input({
      _input: undefined as unknown as { subName: string },
      _output: undefined as unknown as { subName: string },
      parse(value: unknown) {
        const subName = (value as { subName?: unknown } | null)?.subName;
        if (
          typeof subName !== "string" ||
          !/^[a-zA-Z0-9_-]{2,21}$/.test(subName)
        )
          throw new UploadThingError("Choose a community before uploading.");
        return { subName };
      },
    })
    .middleware(async ({ files, input }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();
      // This code runs on your server before upload

      // If you throw, the user will not be able to upload
      if (!user) throw new UploadThingError("Please log in");
      try {
        await assertParticipation(user.id, input.subName);
      } catch {
        throw new UploadThingError(
          "Uploads are unavailable while participation is restricted or the community is removed.",
        );
      }
      if (
        files.some(
          (file) =>
            !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
              file.type,
            ),
        )
      ) {
        throw new UploadThingError("Upload a JPEG, PNG, WebP or GIF image");
      }

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: user.id };
    })
    .onUploadComplete(async () => ({})),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
