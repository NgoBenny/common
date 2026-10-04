import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MenuIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { LoginLink, LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";

interface iAppProps {
  userImage: string | null;
  userName?: string | null;
  siteModerator?: boolean;
}

export function UserDropdown({
  userImage,
  userName,
  siteModerator,
}: iAppProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu">
        <div className="rounded-xl px-2 py-2 flex min-h-11 items-center gap-x-3 hover:bg-muted">
          <MenuIcon className="w-6 h-6 lg:w-5 lg:h-5" />
          <Image
            width={32}
            height={32}
            unoptimized
            src={userImage ?? "/avatar.svg"}
            alt="Your user avatar"
            className="rounded-full h-8 w-8 hidden sm:block"
            referrerPolicy="no-referrer"
          />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[200px]">
        {siteModerator && (
          <DropdownMenuItem asChild>
            <Link href="/moderation">Site moderation</Link>
          </DropdownMenuItem>
        )}
        {userName && (
          <DropdownMenuItem asChild>
            <Link href={`/u/${userName}`}>My profile</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/saved">Saved posts</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/?feed=home">Joined communities feed</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link className="w-full" href="/">
            Homepage
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link className="w-full" href="/settings">
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <LoginLink authUrlParams={{ prompt: "login" }}>
            Switch account
          </LoginLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <LogoutLink className="w-full">Logout</LogoutLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
