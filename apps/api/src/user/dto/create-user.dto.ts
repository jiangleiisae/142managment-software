import { Permission, UserRole } from '@prisma/client';
import { IsArray, IsEmail, IsEnum, IsIn, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  password!: string;

  /// 不允许在此创建OWNER账户(OWNER仅通过/auth/register注册时生成)
  @IsIn([UserRole.ADMIN, UserRole.STAFF])
  role!: UserRole;

  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions!: Permission[];
}
