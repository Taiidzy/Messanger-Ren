/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo } from "react";
import { CardHeader, CardTitle } from "./card";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { getInitials, getUserStatusTime } from "@/components/utils/format";
import { useTheme, getTextStyle } from "@/components/theme/ThemeProvider";
import { API_URL } from "@/components/utils/const";

interface UserInfoProps {
  user: {
    companion_avatar: string;
    companion_userName: string;
  };
  connectionState: {
    isConnected: boolean;
    isRegistered: boolean;
  };
  status: boolean;
  userStatusTime: string;
}

const UserInfo: React.FC<UserInfoProps> = React.memo(({ user, status, userStatusTime }) => {
  const { theme } = useTheme();
  
  // Мемоизируем avatarTime, чтобы он не пересоздавался при каждом рендере
  const avatarTime = useMemo(() => new Date().getTime(), [user.companion_avatar]);
  
  // Мемоизируем URL аватара
  const avatarUrl = useMemo(() => 
    `${API_URL}/storage/avatars/${user.companion_avatar}?${avatarTime}`,
    [user.companion_avatar, avatarTime]
  );
  
  // Мемоизируем инициалы
  const initials = useMemo(() => 
    getInitials(user.companion_userName),
    [user.companion_userName]
  );
  
  // Мемоизируем статус время
  const statusTimeText = useMemo(() => 
    status ? "" : getUserStatusTime(userStatusTime),
    [status, userStatusTime]
  );

  return (
    <CardHeader className="flex-shrink-0">
      <div className="flex items-center gap-3">
        <Avatar className={`h-12 w-12 border-2 ${status ? "border-green-400" : "border-red-400"}`}>
          <AvatarImage
            src={avatarUrl}
            alt={user.companion_userName}
            className="object-cover w-full h-full"
          />
          <AvatarFallback>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <CardTitle className={`text-2xl font-bold ${getTextStyle(theme)}`}>
            {user.companion_userName}
          </CardTitle>
          <span className={`text-sm font-bold ${getTextStyle(theme)}`}>
            {statusTimeText}
          </span>
        </div>
      </div>
    </CardHeader>
  );
});

UserInfo.displayName = 'UserInfo';

export default UserInfo;