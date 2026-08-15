import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'ScheduledMessages',
  timestamps: true,
})
export class ScheduledMessage extends Model {
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  sender: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  receiver: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  message: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: false,
  })
  scheduleTime: number;

  @Column({
    type: DataType.ENUM('pending', 'sent', 'failed'),
    defaultValue: 'pending',
  })
  status: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: true,
    defaultValue: () => Date.now(),
  })
  createdAt: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: DataType.NOW,
  })
  updatedAt: Date;
}
