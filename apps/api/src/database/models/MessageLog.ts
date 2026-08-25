import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Campaign } from './Campaign';

@Table({
  tableName: 'MessageLogs',
  timestamps: true,
})
export class MessageLog extends Model {
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
    type: DataType.STRING,
    defaultValue: 'sent',
  })
  status: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  messageId: string;

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

  @Column({
    type: DataType.BIGINT,
    defaultValue: () => Date.now(),
  })
  timestamp: number;

  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  campaignId: number;

  @BelongsTo(() => Campaign)
  campaign: Campaign;
}
