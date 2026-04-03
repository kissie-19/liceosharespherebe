import type { RowDataPacket } from "mysql2";

export interface UserModel extends RowDataPacket {
  id: number;
  fullname: string;
  email: string;
  sex: 'Female' | 'Male';
  department: 'College of Arts and Sciences' | 'School of Business, Management and Accountancy' | 
  'College of Criminal Justice' | 'College of Engineering' | 
  'College of Information Technology' | 'College of Medical Laboratory Science' |
  'Conservatory of Music, Theater and Dance' | 'College of Nursing' | 
  'College of Dentistry' | 'College of Pharmacy' | 'College of Rehabilitation Sciences' | 
  'College of Radiologic Technology' |  'School of Teacher Education';
  contact_number: number;
  password: string;
  created_at: Date;
}

export interface RegisterModel {
  confirm_password: any;
  id: number;
  fullname: string;
  email: string;
  sex: 'Female' | 'Male';
  department: 'College of Arts and Sciences' | 'School of Business, Management and Accountancy' | 
  'College of Criminal Justice' | 'College of Engineering' | 
  'College of Information Technology' | 'College of Medical Laboratory Science' |
  'Conservatory of Music, Theater and Dance' | 'College of Nursing' | 
  'College of Dentistry' | 'College of Pharmacy' | 'College of Rehabilitation Sciences' | 
  'College of Radiologic Technology' |  'School of Teacher Education';
  contact_number: number;
  password: string;
  created_at: Date;
}

export interface LoginModel {
  email: string;
  password: string;
}