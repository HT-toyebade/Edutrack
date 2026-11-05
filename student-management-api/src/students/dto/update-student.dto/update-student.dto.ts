import { PartialType } from "@nestjs/mapped-types";
// import { CreateStudentDto } from "../create-student.dto.js";
import { CreateStudentDto } from '../create-student.dto/create-student.dto.js';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}
