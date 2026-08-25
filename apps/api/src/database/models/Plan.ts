import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'Plans',
  timestamps: true,
})
export class Plan extends Model {
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  planId: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  days: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  price: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: DataType.NOW,
  })
  createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: DataType.NOW,
  })
  updatedAt: Date;
}
