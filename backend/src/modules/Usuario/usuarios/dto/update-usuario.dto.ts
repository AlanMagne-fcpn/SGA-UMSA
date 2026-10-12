import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsEmail({}, { message: 'Debe proporcionar un email válido.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password?: string;

  @IsOptional()
  estado?: number;

  @IsOptional()
  requiere_cambio_password?: boolean;

  /** libre: todos los eventos. restringido: solo los eventos asignados. */
  @IsOptional()
  @IsIn(['libre', 'restringido'])
  alcance_eventos?: 'libre' | 'restringido';
}
