import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'Stats',
  timestamps: false,
})
export class Stat extends Model<Stat> {
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  totalMessagesSent: number;
}
