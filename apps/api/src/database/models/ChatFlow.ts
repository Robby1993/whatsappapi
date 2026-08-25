import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'ChatFlows',
  timestamps: true,
})
export class ChatFlow extends Model<ChatFlow> {
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  userNumber: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  botPhone: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
  })
  triggerKeywords: string[];

  @Column({
    type: DataType.JSON,
    allowNull: false,
  })
  steps: any[];

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;

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
