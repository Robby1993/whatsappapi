import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'Campaigns',
  timestamps: true,
})
export class Campaign extends Model {
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  sender: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  message: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  totalContacts: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  sentCount: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  failedCount: number;

  @Column({
    type: DataType.ENUM('pending', 'processing', 'completed'),
    defaultValue: 'pending',
  })
  status: string;
}
