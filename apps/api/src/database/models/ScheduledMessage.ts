import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'ScheduledMessages',
  timestamps: true,
})
export class ScheduledMessage extends Model<ScheduledMessage> {
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
    type: DataType.STRING,
    allowNull: true,
  })
  mediaUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  mediaType: string;

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
