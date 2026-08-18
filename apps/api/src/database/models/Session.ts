import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';

@Table({
  tableName: 'Sessions',
  timestamps: false,
})
export class Session extends Model {
  @PrimaryKey
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  phone: string;

  @PrimaryKey
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  dataType: string;

  @PrimaryKey
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  dataId: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  data: string;
}
