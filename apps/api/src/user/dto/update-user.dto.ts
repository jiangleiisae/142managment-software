import { Permission, UserRole } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';

export class UpdateUserDto {
  /// 不允许改为OWNER, 也不允许修改OWNER账户本身(见service层校验)
  @IsOptional()
  @IsIn([UserRole.ADMIN, UserRole.STAFF])
  role?: UserRole;

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
