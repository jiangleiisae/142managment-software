import { IsEmail, IsString, MinLength } from 'class-validator';

/// 注册即创建一个新租户 + 该租户的第一个用户 (OWNER角色)
export class RegisterDto {
  @IsString()
  @MinLength(1)
  tenantName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  password!: string;
}
