// src\app\modules\services\services.interface.ts
import { Model, Types } from 'mongoose';
export type IService = {
  name: string;
  description: string;
  duration: number;
  price: number;
  maxAppointmentsPerSlot: number;
  salon: Types.ObjectId;
  status: 'active' | 'inactive';
  category: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
export type ServiceModel = {
  isServiceExist(id: string): Promise<IService | null>;
} & Model<IService>;

