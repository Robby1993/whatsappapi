import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Campaign } from './Campaign';

@Table({
  tableName: 'QueuedMessages',
  timestamps: true,
})
export class QueuedMessage extends Model {
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
    type: DataType.ENUM('pending', 'processing', 'sent', 'failed'),
    defaultValue: 'pending',
  })
  status: string;

  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  campaignId: number;

  @BelongsTo(() => Campaign)
  campaign: Campaign;

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
